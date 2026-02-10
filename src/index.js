import { Actor } from "apify";
import { spawn } from "child_process";
import fs from "fs";
import { runFetcher } from "./fetcher.js"; // Path updated for src directory
import { parseBookingFlights, parseSearchFlights } from "./parser.js"; // Path updated for src directory
import { generatGoogleFlightsURL } from "./url_generator.js"; // Path updated for src directory

/**
 * Spawns a Python process to handle data transformation.
 * @param {string} scriptPath - Path to the Python script.
 * @param {object} inputData - The JSON object to send to the script's stdin.
 * @returns {Promise<string>} The stdout from the Python script.
 */
function runPythonScript(scriptPath, inputData) {
  return new Promise((resolve, reject) => {
    // Try to use the virtual environment's python if it exists
    const pythonExecutable = fs.existsSync("./.venv/bin/python3")
      ? "./.venv/bin/python3"
      : "python3";

    const pythonProcess = spawn(pythonExecutable, [scriptPath]);
    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => (stdout += data.toString()));
    pythonProcess.stderr.on("data", (data) => (stderr += data.toString()));

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(
            `Python script ${scriptPath} exited with code ${code}: ${stderr}`
          )
        );
      }
      resolve(stdout.trim());
    });

    pythonProcess.stdin.write(JSON.stringify(inputData));
    pythonProcess.stdin.end();
  });
}

await Actor.init();

const rawInput = await Actor.getInput();
const { debug, only_direct_airline_booking, ...userInput } = rawInput;

try {
  // 1️⃣ Normalize the user input
  const normalizedInputJson = await runPythonScript(
    "src/input_normalizer/input_normalize.py",
    userInput
  );
  const normalizedInput = JSON.parse(normalizedInputJson);

  // 2️⃣ Handle Search Flow (Default behavior)
  // 1. Search for outbound flights
  const outboundLeg = normalizedInput.itinerary[0];
  const outboundInput = {
    ...normalizedInput,
    itinerary: [outboundLeg],
    trip_type: "trip_type_one_way",
  };

  const outboundTfs = await runPythonScript(
    "src/serializer/flight_serializer.py",
    outboundInput
  );
  const outboundUrl = await generatGoogleFlightsURL(outboundTfs, {
    type: "search",
  });
  let outboundFlights = [];
  try {
    const outboundFetchResult = await runFetcher(outboundUrl, {
      debug,
      id: `outbound-search-${Date.now()}`,
    });
    if (outboundFetchResult?.html) {
      outboundFlights = parseSearchFlights(outboundFetchResult.html).flights;
    }
  } catch (e) {
    console.error(`Failed to fetch or parse outbound flights: ${e.message}`);
  }
  console.log(`Found ${outboundFlights.length} outbound flight options.`);

  // Apply limit to outbound flights if specified
  if (rawInput.max_outbound_flight_limit && rawInput.max_outbound_flight_limit > 0) {
    console.log(`Limiting outbound flights to ${rawInput.max_outbound_flight_limit} options.`);
    outboundFlights = outboundFlights.slice(0, rawInput.max_outbound_flight_limit);
  }

  const finalResults = [];

  if (
    normalizedInput.trip_type === "trip_type_round" &&
    normalizedInput.itinerary.length > 1
  ) {
    // 2. For each outbound flight, search for return flights
    for (const outboundFlight of outboundFlights) {
      // Prepare input to find return flights, with the outbound flight fixed.
      const returnSearchUserInput = {
        ...userInput,
        fixed_flights: {
          outbound: outboundFlight.segments,
        },
      };
      // We need to re-normalize and serialize.
      const returnNormalizedJson = await runPythonScript(
        "src/input_normalizer/input_normalize.py",
        returnSearchUserInput
      );
      const returnInput = JSON.parse(returnNormalizedJson);

      // Now serialize for the search URL.
      const returnTfs = await runPythonScript(
        "src/serializer/flight_serializer.py",
        returnInput
      );
      const returnUrl = await generatGoogleFlightsURL(returnTfs, {
        type: "search",
      });
      let returnFlights = [];
      try {
        const returnFetchResult = await runFetcher(returnUrl, {
          debug,
          id: `return-search-${outboundFlights.indexOf(
            outboundFlight
          )}-${Date.now()}`,
        });
        if (returnFetchResult?.html) {
          returnFlights = parseSearchFlights(returnFetchResult.html).flights;
        }
      } catch (e) {
        console.error(
          `Failed to fetch or parse return flights: ${e.message}`
        );
      }
      console.log(`Found ${returnFlights.length} return flight options.`);

      // Apply limit to return flights if specified
      if (rawInput.max_return_flight_limit && rawInput.max_return_flight_limit > 0) {
        console.log(`Limiting return flights to ${rawInput.max_return_flight_limit} options.`);
        returnFlights = returnFlights.slice(0, rawInput.max_return_flight_limit);
      }

      // 3. For each outbound-return pair, get the price
      const bookingPromises = returnFlights.map(async (returnFlight, i) => {
        const bookingInput = {
          ...normalizedInput,
          itinerary: [
            {
              ...normalizedInput.itinerary[0],
              segments: outboundFlight.segments,
            },
            {
              ...normalizedInput.itinerary[1],
              segments: returnFlight.segments,
            },
          ],
          trip_type: "trip_type_round",
        };
        const bookingTfs = await runPythonScript(
          "src/serializer/flight_serializer.py",
          bookingInput
        );
        const bookingUrl = await generatGoogleFlightsURL(bookingTfs, {
          type: "booking",
        });
        try {
          const bookingFetchResult = await runFetcher(bookingUrl, {
            debug,
            id: `booking-round-trip-${i}-${Date.now()}`,
          });
          const parsed = parseBookingFlights(bookingFetchResult.html);
          // Return each flight with the bookingUrl
          return parsed.flights.flatMap((flight) => {
            if (flight.booking_options && flight.booking_options.length > 0) {
              return flight.booking_options.map((option) => {
                const { booking_options, ...flightData } = flight;
                return {
                  ...flightData,
                  bookingUrl,
                  price: option.price
                    ? option.price.replace(/^from\s*/, "").trim()
                    : null,
                  agent: option.name ? option.name.replace(/^Book with\s*/, "").replace(/Airline$/, "").trim() : null,
                  is_direct_airline: option.is_direct_airline,
                };
              });
            }
            return [];
          });
        } catch (e) {
          console.error(
            `Failed to get booking details for a round-trip combination: ${e.message}`
          );
          return null; // Return null for failed attempts
        }
      });

      const allBookingDetails = (await Promise.all(bookingPromises)).filter(
        (result) => result && result.length > 0
      );
      finalResults.push(...allBookingDetails.flat());

      if (
        rawInput.max_results > 0 &&
        finalResults.length >= rawInput.max_results
      ) {
        break; // Break outer loop
      }
    }
  } else {
    // One-way trip: get price for each found flight
    const bookingPromises = outboundFlights.map(async (flight, i) => {
      const bookingInput = {
        ...normalizedInput,
        itinerary: [
          { ...normalizedInput.itinerary[0], segments: flight.segments },
        ],
      };
      const bookingTfs = await runPythonScript(
        "src/serializer/flight_serializer.py",
        bookingInput
      );
      const bookingUrl = await generatGoogleFlightsURL(bookingTfs, {
        type: "booking",
      });
      try {
        const bookingFetchResult = await runFetcher(bookingUrl, {
          debug,
          id: `booking-one-way-${i}-${Date.now()}`,
        });
        const parsed = parseBookingFlights(bookingFetchResult.html);
        // Return each flight with the bookingUrl
        return parsed.flights.flatMap((flight) => {
          if (flight.booking_options && flight.booking_options.length > 0) {
            return flight.booking_options.map((option) => {
              const { booking_options, ...flightData } = flight;
              return {
                ...flightData,
                bookingUrl,
                price: option.price
                  ? option.price.replace(/^from\s*/, "").trim()
                  : null,
                agent: option.name ? option.name.replace(/^Book with\s*/, "").replace(/Airline$/, "").trim() : null,
                is_direct_airline: option.is_direct_airline,
              };
            });
          }
          return [];
        });
      } catch (e) {
        console.error(
          `Failed to get booking details for a one-way flight: ${e.message}`
        );
        return null; // Return null for failed attempts
      }
    });

    let allBookingDetails = (await Promise.all(bookingPromises)).filter(
      (result) => result && result.length > 0
    );

    if (rawInput.max_results > 0) {
      allBookingDetails = allBookingDetails.slice(0, rawInput.max_results);
    }

    finalResults.push(...allBookingDetails.flat());
  }

  if (finalResults.length > 0) {
    let output = finalResults;
    if (rawInput.only_direct_airline_booking) {
      output = output.filter((flight) => flight.is_direct_airline);
    }
    await Actor.pushData(output);
  } else {
    await Actor.pushData([]);
  }
} catch (error) {
  console.error("An error occurred during the actor run:");
  console.error(error);
  await Actor.fail(error.message);
}

await Actor.exit();

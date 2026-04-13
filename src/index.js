import { Actor } from "apify";
import { PlaywrightCrawler, createPlaywrightRouter } from "crawlee";
import { parseBookingFlights, parseSearchFlights } from "./parser.js";
import { generatGoogleFlightsURL } from "./url_generator.js";
import { normalizeInput } from "./input_normalizer/input_normalize.js";
import { serializeBase64Url } from "./serializer/flight_serializer.js";

await Actor.init();

const rawInput = await Actor.getInput();
const {
  debug,
  only_direct_airline_booking,
  max_crawler_runtime_secs = 60,
  max_results = 0,
  max_outbound_flight_limit = 3,
  max_return_flight_limit = 3,
  currency = "USD",
  ...userInput
} = rawInput;

// 1️⃣ Normalize the initial user input
const normalizedInput = normalizeInput(userInput);

const router = createPlaywrightRouter();

let resultsCount = 0;

router.addHandler("SEARCH", async ({ page, request, log, crawler }) => {
  if (max_results > 0 && resultsCount >= max_results) {
    log.info("Max results reached, skipping search.");
    return;
  }
  const { type, outboundFlight } = request.userData;
  const xhrKeyword = request.url.includes("/flights/booking?tfs=") ? "GetBookingResults" : "GetShoppingResults";
  const timeoutMs = (max_crawler_runtime_secs * 1000) - 5000;

  log.info(`Processing ${type} search: ${request.url}`);

  // Wait for appropriate XHR
  await page.waitForResponse((r) => r.url().includes(xhrKeyword), { timeout: timeoutMs }).catch(() => {});

  const html = await page.content();
  const { flights } = parseSearchFlights(html);
  log.info(`Found ${flights.length} flights for ${type} search.`);

  if (type === "OUTBOUND") {
    let outboundFlights = flights;
    if (max_outbound_flight_limit > 0) {
      outboundFlights = outboundFlights.slice(0, max_outbound_flight_limit);
    }

    for (const flight of outboundFlights) {
      if (max_results > 0 && resultsCount >= max_results) break;
      if (normalizedInput.trip_type === "trip_type_round") {
        // Prepare return search
        const returnSearchUserInput = {
          ...userInput,
          fixed_flights: { outbound: flight.segments },
        };
        const returnInput = normalizeInput(returnSearchUserInput);
        const returnTfs = await serializeBase64Url(returnInput);
        const returnUrl = generatGoogleFlightsURL(returnTfs, { type: "search", currency });

        await crawler.addRequests([{
          url: returnUrl.toString(),
          label: "SEARCH",
          userData: { type: "RETURN", outboundFlight: flight },
        }]);
      } else {
        // One-way: go to booking
        const bookingInput = {
          ...normalizedInput,
          itinerary: [{ ...normalizedInput.itinerary[0], segments: flight.segments }],
        };
        const bookingTfs = await serializeBase64Url(bookingInput);
        const bookingUrl = generatGoogleFlightsURL(bookingTfs, { type: "booking", currency });

        await crawler.addRequests([{
          url: bookingUrl.toString(),
          label: "BOOKING",
          userData: { outboundFlight: flight },
        }]);
      }
    }
  } else if (type === "RETURN") {
    let returnFlights = flights;
    if (max_return_flight_limit > 0) {
      returnFlights = returnFlights.slice(0, max_return_flight_limit);
    }

    for (const returnFlight of returnFlights) {
      if (max_results > 0 && resultsCount >= max_results) break;
      const bookingInput = {
        ...normalizedInput,
        itinerary: [
          { ...normalizedInput.itinerary[0], segments: outboundFlight.segments },
          { ...normalizedInput.itinerary[1], segments: returnFlight.segments },
        ],
        trip_type: "trip_type_round",
      };
      const bookingTfs = await serializeBase64Url(bookingInput);
      const bookingUrl = generatGoogleFlightsURL(bookingTfs, { type: "booking", currency });

      await crawler.addRequests([{
        url: bookingUrl.toString(),
        label: "BOOKING",
        userData: { outboundFlight, returnFlight },
      }]);
    }
  }
});

router.addHandler("BOOKING", async ({ page, request, log }) => {
  log.info(`Processing booking page: ${request.url}`);
  const { priceCheckOnly } = request.userData;

  const timeoutMs = (max_crawler_runtime_secs * 1000) - 5000;
  await page.waitForResponse((r) => r.url().includes("GetBookingResults"), { timeout: timeoutMs }).catch(() => {});

  let output = [];

  if (priceCheckOnly) {
    // Price-check mode: the caller already knows the flight segments, so we skip
    // the expensive "Flight details" button expansion. We only need prices and
    // provider info, which are available in the DOM right after the XHR fires.
    await page.waitForSelector("div.gN1nAc", { timeout: 2000 }).catch(() => {});

    const rawOptions = await page.evaluate(() =>
      Array.from(document.querySelectorAll("div.gN1nAc")).map((el) => ({
        name: el.querySelector("div.ogfYpf.AdWm1c")?.textContent?.trim() ?? "",
        price: el.querySelector("div.ScwYP")?.textContent?.replace(/^from\s+/i, "").trim() ?? null,
        is_direct_airline: el.querySelector("div.sSHqwe.wZlgrf.EA71Tc") !== null,
      })).filter((o) => o.name && !o.name.startsWith("Call "))
    );

    output = rawOptions.map((o) => ({
      bookingUrl: request.url,
      price: o.price,
      agent: o.name.replace(/^Book with\s*/i, "").replace(/Airline$/i, "").trim(),
      is_direct_airline: o.is_direct_airline,
    }));
  } else {
    // Full mode: expand segment details for rich output (search-discovered flights).
    try {
      const buttons = await page.$$('button[jsname="LgbsSe"][aria-label^="Flight details"]');
      for (const button of buttons) {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await page.waitForSelector('div[jscontroller="GQaSVc"]', { timeout: 5000 }).catch(() => {});
      }
      const hideButtons = await page.$$('button:has(span:has-text("Hide options"))');
      for (const button of hideButtons) {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await page.waitForSelector('button:has(span:has-text("Hide options"))', { state: "hidden", timeout: 3000 }).catch(() => {});
      }
    } catch (err) {
      log.debug(`Error expanding details: ${err.message}`);
    }

    const html = await page.content();
    const { flights: bookingFlights } = parseBookingFlights(html);

    output = bookingFlights.flatMap((flight) => {
      if (flight.booking_options && flight.booking_options.length > 0) {
        return flight.booking_options.map((option) => {
          const { booking_options, ...flightData } = flight;
          return {
            ...flightData,
            bookingUrl: request.url,
            price: option.price ? option.price.replace(/^from\s*/, "").trim() : null,
            agent: option.name ? option.name.replace(/^Book with\s*/, "").replace(/Airline$/, "").trim() : null,
            is_direct_airline: option.is_direct_airline,
          };
        });
      }
      return [];
    });
  }

  if (only_direct_airline_booking) {
    output = output.filter((f) => f.is_direct_airline);
  }

  if (output.length > 0) {
    resultsCount += output.length;
    await Actor.pushData(output);
  }
});

const crawler = new PlaywrightCrawler({
  proxyConfiguration: await Actor.createProxyConfiguration(),
  requestHandler: router,
  headless: !debug,
  useSessionPool: true,
  maxRequestRetries: 2,
  maxConcurrency: 3,
  requestHandlerTimeoutSecs: max_crawler_runtime_secs + 30,
  browserPoolOptions: {
    useFingerprints: true,
    fingerprintOptions: {
      fingerprintGeneratorOptions: {
        browsers: ["chrome"],
        devices: ["desktop"],
        operatingSystems: ["windows"],
      },
    },
  },
});

// Price check mode: if all outbound segments have airline_code + flight_number,
// skip search and go directly to the booking page.
const outboundSegments = normalizedInput.itinerary[0]?.segments || [];
const isPriceCheckMode = outboundSegments.length > 0 &&
  outboundSegments.every((s) => s.airline_code && s.flight_number);

if (isPriceCheckMode) {
  const bookingTfs = await serializeBase64Url(normalizedInput);
  const bookingUrl = generatGoogleFlightsURL(bookingTfs, { type: "booking", currency });
  await crawler.run([{
    url: bookingUrl.toString(),
    label: "BOOKING",
    userData: { priceCheckOnly: true },
  }]);
} else {
  // Search mode: discover flights, then visit booking pages.
  const outboundLeg = normalizedInput.itinerary[0];
  const outboundInput = {
    ...normalizedInput,
    itinerary: [outboundLeg],
    trip_type: "trip_type_one_way",
  };
  const outboundTfs = await serializeBase64Url(outboundInput);
  const outboundUrl = generatGoogleFlightsURL(outboundTfs, { type: "search", currency });
  await crawler.run([{
    url: outboundUrl.toString(),
    label: "SEARCH",
    userData: { type: "OUTBOUND" },
  }]);
}

await Actor.exit();

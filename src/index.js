import { Actor } from "apify";
import { spawn } from "child_process";
import { runFetcher } from "./fetcher.js"; // Path updated for src directory
import { parseBookingFlights, parseSearchFlights } from "./parser.js"; // Path updated for src directory
import { generatGoogleFlightsURL } from "./url_generator.js"; // Path updated for src directory

await Actor.init();

const rawInput = await Actor.getInput();
const { type, debug, ...userInput } = rawInput;

// 1️⃣ Normalize the user input by calling the Python normalizer script
console.log("Calling Python input normalizer...");
const normalizerProcess = spawn("python3", ["src/input_normalizer/input_normalize.py"]);

let normalizedInputJson;
const normalizerPromise = new Promise((resolve, reject) => {
  let stdout = "";
  let stderr = "";
  normalizerProcess.stdout.on("data", (data) => (stdout += data.toString()));
  normalizerProcess.stderr.on("data", (data) => (stderr += data.toString()));
  normalizerProcess.on("close", (code) => {
    if (code !== 0) {
      return reject(
        new Error(`Python script exited with code ${code}: ${stderr}`)
      );
    }
    normalizedInputJson = stdout.trim();
    resolve();
  });
});

normalizerProcess.stdin.write(JSON.stringify(userInput));
normalizerProcess.stdin.end();

await normalizerPromise;
console.log("Received normalized input from Python.");

// 2️⃣ Get tfs from Python serializer using the normalized input
console.log("Calling Python serializer...");
const serializerProcess = spawn("python3", ["src/serializer/flight_serializer.py"]); // Path updated for src directory

let tfsUrl;
const serializerPromise = new Promise((resolve, reject) => {
  let stdout = "";
  let stderr = "";
  serializerProcess.stdout.on("data", (data) => (stdout += data.toString()));
  serializerProcess.stderr.on("data", (data) => (stderr += data.toString()));
  serializerProcess.on("close", (code) => {
    if (code !== 0) {
      return reject(new Error(`Python script exited with code ${code}: ${stderr}`));
    }
    tfsUrl = stdout.trim();
    resolve();
  });
});

pythonProcess.stdin.write(JSON.stringify(serializerInput));
pythonProcess.stdin.end();
const serializerInput = JSON.parse(normalizedInputJson);
serializerProcess.stdin.write(JSON.stringify({ ...serializerInput, type, debug }));
serializerProcess.stdin.end();

await serializerPromise;
console.log(`Received tfs from Python: ${tfsUrl}`);

// 3️⃣ Generate URL and fetch page
const googleFlightsUrl = await generatGoogleFlightsURL(tfsUrl, { type });
const fetched = await runFetcher(googleFlightsUrl, { debug });

// 4️⃣ Parse results
const parser = type === "booking" ? parseBookingFlights : parseSearchFlights;
const parsed = parser(fetched.html);

// 5️⃣ Store results
await Actor.pushData(parsed);

await Actor.exit();

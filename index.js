import { Actor } from "apify";
import { spawn } from "child_process";
import { runFetcher } from "./fetcher.js";
import { parseBookingFlights, parseSearchFlights } from "./parser.js";
import { generatGoogleFlightsURL } from "./url_generator.js";

await Actor.init();

const input = await Actor.getInput();
const { type, debug, ...serializerInput } = input;

// 1️⃣ Get tfs from Python serializer
console.log("Calling Python serializer...");
const pythonProcess = spawn("python3", ["serializer/flight_serializer.py"]);

let tfsUrl;
const pythonPromise = new Promise((resolve, reject) => {
  let stdout = "";
  let stderr = "";
  pythonProcess.stdout.on("data", (data) => (stdout += data.toString()));
  pythonProcess.stderr.on("data", (data) => (stderr += data.toString()));
  pythonProcess.on("close", (code) => {
    if (code !== 0) {
      return reject(
        new Error(`Python script exited with code ${code}: ${stderr}`)
      );
    }
    tfsUrl = stdout.trim();
    resolve();
  });
});

pythonProcess.stdin.write(JSON.stringify(serializerInput));
pythonProcess.stdin.end();

await pythonPromise;
console.log(`Received tfs from Python: ${tfsUrl}`);

// 2️⃣ Generate URL and fetch page
const googleFlightsUrl = await generatGoogleFlightsURL(tfsUrl, { type });
const fetched = await runFetcher(googleFlightsUrl, { debug });

// 3️⃣ Parse results
const parser = type === "booking" ? parseBookingFlights : parseSearchFlights;
const parsed = parser(fetched.html);

// 4️⃣ Store results
await Actor.pushData(parsed);

await Actor.exit();

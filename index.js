import { Actor } from "apify";
import { runFetcher } from "./fetcher.js";
import { parseFlightsPage } from "./parser.js";

await Actor.init();

const input = await Actor.getInput();
const { tfsUrl } = input;

// 1️⃣ Fetch page
const fetched = await runFetcher({ tfsUrl });

// 2️⃣ Parse results
const parsed = parseFlightsPage(fetched.html);

// 3️⃣ Store results
await Actor.pushData(parsed);

await Actor.exit();

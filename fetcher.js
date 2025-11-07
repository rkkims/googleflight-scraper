import { PlaywrightCrawler } from "crawlee";
import fs from "fs";

/**
 * Fetch and return page HTML and flight data from a URL object.
 * Waits for GetShoppingResults XHR to complete.
 * @param {URL} urlObj - Fully constructed URL.
 * @param {object} [options]
 * @param {boolean} [options.debug=false] - Show browser window if true.
 * @returns {Promise<{url:string, html:string, flightData:any}>}
 */
export async function runFetcher(urlObj, options = {}) {
  if (!(urlObj instanceof URL)) {
    throw new TypeError("runFetcher expects a URL object.");
  }

  const { debug = false } = options;
  let result = null;

  const crawler = new PlaywrightCrawler({
    headless: !debug,
    useSessionPool: true,
    maxRequestRetries: 4,
    maxConcurrency: 2,
    navigationTimeoutSecs: 45,

    async requestHandler({ page, request, log }) {
      log.info(`Fetching: ${request.url}`);
      await page.goto(request.url, { waitUntil: "domcontentloaded" });

      // --- Wait for GetShoppingResults XHR ---
      const flightData = await new Promise((resolve, reject) => {
        const timeoutMs = 30000;
        const startTime = Date.now();

        const onResponse = async (response) => {
          const url = response.url();
          if (url.includes("GetShoppingResults")) {
            try {
              const json = await response.json();
              page.off("response", onResponse);
              resolve(json);
            } catch (err) {
              page.off("response", onResponse);
              resolve(null);
            }
          }
        };

        page.on("response", onResponse);

        const timer = setInterval(() => {
          if (Date.now() - startTime > timeoutMs) {
            page.off("response", onResponse);
            clearInterval(timer);
            reject(
              new Error(
                "Timeout waiting for GetShoppingResults XHR to complete"
              )
            );
          }
        }, 100);
      });

      const htmlContent = await page.content();

      // --- Save HTML to file ---
      fs.writeFileSync("output.html", htmlContent, "utf-8");
      log.info("HTML content saved to output.html");

      result = { url: request.url, html: htmlContent };
    },

    failedRequestHandler({ request }) {
      console.warn(`Request ${request.url} failed after retries.`);
    },
  });

  await crawler.run([{ url: urlObj.href }]);
  return result;
}

(async () => {
  try {
    const url = new URL(
      "https://www.google.com/travel/flights/search?tfs=GhoSCjIwMjUtMTItMDNqBRIDWVZScgUSA05SVBoaEgoyMDI1LTEyLTEwagUSA05SVHIFEgNZVlJCAwEBAkgBmAEB"
    );

    const fetched = await runFetcher(url, { debug: false });
    console.log("Fetched page URL:", fetched.url);
    console.log("HTML saved to output.html");
  } catch (err) {
    console.error("Error during fetch:", err);
  }
})();

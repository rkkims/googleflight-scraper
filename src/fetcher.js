import { PlaywrightCrawler } from "crawlee";
import fs from "fs";

/**
 * Fetch and return HTML from a Google Flights search or booking page.
 * - Detects page type automatically (search vs booking)
 * - Waits for the appropriate XHR request to complete
 * - Expands details on booking pages by clicking buttons
 * - Saves the final HTML to `output.html`
 *
 * @param {URL} urlObj - Fully constructed Google Flights URL
 * @param {object} [options]
 * @param {boolean} [options.debug=false] - Show browser window if true
 * @returns {Promise<{url: string, html: string}>}
 */
export async function runFetcher(urlObj, options = {}) {
  if (!(urlObj instanceof URL))
    throw new TypeError("runFetcher expects a URL object.");

  const { debug = false } = options;
  const urlStr = urlObj.href;
  const isBookingPage = urlStr.includes("/flights/booking?tfs=");
  const xhrKeyword = isBookingPage ? "GetBookingResults" : "GetShoppingResults";
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

      // --- Wait for appropriate XHR (booking or search)
      log.info(`Waiting for XHR: ${xhrKeyword}`);
      await new Promise((resolve, reject) => {
        const timeoutMs = 30000;
        const startTime = Date.now();

        const onResponse = async (response) => {
          const resUrl = response.url();
          if (resUrl.includes(xhrKeyword)) {
            try {
              await response.json();
              page.off("response", onResponse);
              resolve();
            } catch {
              page.off("response", onResponse);
              resolve();
            }
          }
        };

        page.on("response", onResponse);

        const timer = setInterval(() => {
          if (Date.now() - startTime > timeoutMs) {
            page.off("response", onResponse);
            clearInterval(timer);
            reject(
              new Error(`Timeout waiting for ${xhrKeyword} XHR to complete`)
            );
          }
        }, 100);
      });

      // --- Booking page only: click "Flight details" buttons
      if (isBookingPage) {
        log.info("Detected booking page — expanding flight detail sections...");
        try {
          const buttons = await page.$$(
            'button[jsname="LgbsSe"][aria-label^="Flight details"]'
          );
          if (buttons.length === 0) {
            log.warn("No flight detail buttons found.");
          } else {
            for (const [i, button] of buttons.entries()) {
              const label = await button.getAttribute("aria-label");
              log.info(`Clicking detail button ${i + 1}: ${label}`);
              await button.scrollIntoViewIfNeeded();
              await button.click();
              await page.waitForTimeout(1500); // wait for expand animation
            }
            await page.waitForTimeout(2000); // wait for all details to render
          }
        } catch (err) {
          log.warn(`Error clicking flight detail buttons: ${err.message}`);
        }
      } else {
        log.info("Detected search page — skipping detail clicks.");
      }

      // --- Save final HTML output
      const htmlContent = await page.content();
      fs.writeFileSync("output.html", htmlContent, "utf-8");
      log.info("✅ HTML content saved to output.html");

      result = { url: request.url, html: htmlContent };
    },

    failedRequestHandler({ request }) {
      console.warn(`Request ${request.url} failed after retries.`);
    },
  });

  await crawler.run([{ url: urlStr }]);
  return result;
}

// --- Test run ---
if (process.argv[1].endsWith("fetcher.js")) {
  (async () => {
    try {
      // Example URL (replace with booking or search as needed)
      const url = new URL(
        "https://www.google.com/travel/flights/booking?tfs=CBwQAhqCARIKMjAyNS0xMi0xMSIfCgNZVlISCjIwMjUtMTItMTEaA1NGTyoCQUMyAzU2NCIfCgNTRk8SCjIwMjUtMTItMTEaA0RPSCoCUVIyAzczOCIgCgNET0gSCjIwMjUtMTItMTIaA1NISioCUVIyBDEwNThqBwgBEgNZVlJyBwgBEgNTSEoaggESCjIwMjUtMTItMTgiIAoDU0hKEgoyMDI1LTEyLTE4GgNET0gqAlFSMgQxMDYxIh8KA0RPSBIKMjAyNS0xMi0xOBoDWVlaKgJRUjIDNzY3Ih8KA1lZWhIKMjAyNS0xMi0xOBoDWVZSKgJXUzIDNzM3agcIARIDU0hKcgcIARIDWVZSQAFIAXABggELCP___________wGYAQE"
      );

      const fetched = await runFetcher(url, { debug: false });
      console.log("Fetched page URL:", fetched.url);
      console.log("HTML saved to output.html");
    } catch (err) {
      console.error("❌ Error during fetch:", err);
    }
  })();
}

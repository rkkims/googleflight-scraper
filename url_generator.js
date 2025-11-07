import { URL } from "node:url";

/**
 * @param {string} tfsBase64Url
 * @param {object} options
 * @returns {string}
 */
export async function generatGoogleFlightsURL(tfsBase64Url, options = {}) {
  if (!tfsBase64Url) throw new Error("Missing tfs base64 payload.");

  const {
    type = "search",
    lang = "en",
    region = "CA",
    currency = "CAD",
  } = options;

  const validTypes = ["search", "booking"];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid fetch type "${type}. Use "search or "booking.`);
  }

  const baseurl = `https://www.google.com/travel/flights/${type}`;

  const url = new URL(baseurl);
  url.searchParams.set("tfs", tfsBase64Url);
  url.searchParams.set("hl", lang);
  url.searchParams.set("gl", region);
  url.searchParams.set("curr", currency);

  return url;
}

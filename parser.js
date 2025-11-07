import cheerio from "cheerio";

export function parseFlightSearchPage(html) {
  const $ = cheerio.load(html);
}

export function parseFlightBookingPage(html) {
  const $ = cheerio.load(html);
}

import * as cheerio from "cheerio";

export function parseFlightsPage(html) {
  const $ = cheerio.load(html);
  const flights = [];

  $('div[aria-label*="Flight"]').each((_, el) => {
    const airline = $(el).find("img").attr("alt") || "Unknown Airline";
    const route = $(el).find('div[role="heading"]').text().trim();
    const price = $(el).find('div[aria-label*="Price"]').text().trim();

    flights.push({ airline, route, price });
  });

  return flights;
}

import * as cheerio from "cheerio";
import fs from "fs";

export function parseSearchFlights(html) {
  const $ = cheerio.load(html);
  const flights = [];

  $('div[jsname="IWWDBc"], div[jsname="YdtKid"]').each((i, block) => {
    const isBest = i === 0;
    $(block)
      .find("ul.Rk10dc li")
      .each((_, li) => {
        const url =
          $(li)
            .find("[data-travelimpactmodelwebsiteurl]")
            .attr("data-travelimpactmodelwebsiteurl") ||
          $(li).find("div.NZRfve").attr("data-travelimpactmodelwebsiteurl");
        if (!url) return;

        const segments = [];
        try {
          const p =
            new URL(url).searchParams.get("itinerary")?.split(",") || [];
          for (const seg of p) {
            const [o, d, al, fn, date] = seg.split("-");
            if (date)
              segments.push({
                origin: o,
                destination: d,
                airline_code: al,
                flight_number: fn,
                flight_date: date.replace(
                  /^(\d{4})(\d{2})(\d{2})$/,
                  "$1-$2-$3"
                ),
              });
          }
        } catch {}
        if (segments.length) flights.push({ is_best: isBest, segments });
      });
  });

  const unique = [];
  const seen = new Map();
  for (const f of flights) {
    const k = JSON.stringify(f.segments);
    if (!seen.has(k) || (f.is_best && !seen.get(k).is_best)) seen.set(k, f);
  }
  unique.push(...seen.values());

  return { flights: unique };
}

/**
 * Parse a Google Flights booking page — including detailed segment info,
 * total duration, layovers, amenities, and booking options.
 * @param {string} html - Full HTML of the booking page
 * @returns {{flights: Array}}
 */
export function parseBookingFlights(html) {
  const $ = cheerio.load(html);
  const flights = [];

  $('div[jscontroller="Lqaaf"]').each((_, block) => {
    const flight = {
      segments: [],
      total_duration: null,
      layovers: [],
      amenities: {},
      booking_options: [],
    };

    // --- Extract total duration (top section) ---
    flight.total_duration =
      $(block)
        .find('div[aria-label*="Total duration"], .gvkrdb .ogfYpf')
        .first()
        .text()
        .trim() || null;

    // --- Extract segments ---
    $(block)
      .find('div[jscontroller="GQaSVc"]')
      .each((_, seg) => {
        const origin =
          $(seg).find("div.ZHa2lc.tdMWuf.y52p7d").text().trim() || null;
        const destination =
          $(seg).find("div.FY5t7d.tdMWuf.y52p7d").text().trim() || null;

        const depTime =
          $(seg)
            .find(
              'div[aria-label*="Departure time"], div.gws-flights__time-depart'
            )
            .text()
            .trim() || null;

        const arrTime =
          $(seg)
            .find(
              'div[aria-label*="Arrival time"], div.gws-flights__time-arrive'
            )
            .text()
            .trim() || null;

        const airlineText = $(seg)
          .find("div.MX5RWe.sSHqwe.y52p7d")
          .text()
          .trim();

        const duration =
          $(seg).find("div.P102Lb.sSHqwe.y52p7d").text().trim() || null;

        flight.segments.push({
          origin,
          destination,
          departure_time: depTime,
          arrival_time: arrTime,
          airline_text: airlineText,
          duration,
        });
      });

    // --- Layovers (between flight segments) ---
    $(block)
      .find('div[aria-label*="layover"], .BbR8Ec .ogfYpf')
      .each((_, lay) => {
        const txt = $(lay).text().trim();
        if (txt) flight.layovers.push(txt);
      });

    // Only keep flights with segments or booking info
    if (flight.segments.length || flight.booking_options.length)
      flights.push(flight);
  });

  const booking_options = [];
  // --- Booking options ---
  $("div.gN1nAc").each((_, link) => {
    const name = $(link).find("div.ogfYpf.AdWm1c").text().trim();

    const price = $(link).find("div.BWTl3e > div.CQYfx").text().trim() || null;

    const isAirline = $(link).find("div.sSHqwe.wZlgrf.EA71Tc").length != 0;

    booking_options.push({
      name,
      price,
      is_direct_airline: isAirline,
    });
  });

  return { flights, booking_options };
}

if (process.argv[1].endsWith("parser.js")) {
  const html = fs.readFileSync("./output.html", "utf8");
  const result = parseBookingFlights(html);
  fs.writeFileSync(
    "./flights_with_prices.json",
    JSON.stringify(result, null, 2)
  );
  console.log(
    `✅ ${result.flights.length} flights and prices saved to flights_with_prices.json`
  );
}

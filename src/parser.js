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
                origin_airport: o,
                destination_airport: d,
                airline_code: al,
                flight_number: fn,
                departure_date: date.replace(
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

        const [airline, flight_code, seat_class, aircraft] = $(seg)
          .find("div.MX5RWe.sSHqwe.y52p7d")
          .find("span.Xsgmwe")
          .map((_, t) => $(t).text().trim() || null)
          .get();

        const duration =
          ($(seg).find("div.P102Lb.sSHqwe.y52p7d").text().trim() || "")
            .replace("Travel time: ", "")
            .trim() || null;

        flight.segments.push({
          origin,
          destination,
          departure_time: depTime,
          arrival_time: arrTime,
          airline,
          flight_code,
          seat_class,
          aircraft,
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

  const bookingOptions = [];
  // --- Booking options ---
  $("div.gN1nAc").each((_, link) => {
    const name = $(link).find("div.ogfYpf.AdWm1c").text().trim();
    if (name.startsWith("Call ")) return;

    const price = $(link).find("div.BWTl3e > div.CQYfx").text().trim() || null;

    const isAirline = $(link).find("div.sSHqwe.wZlgrf.EA71Tc").length != 0;

    bookingOptions.push({
      name,
      price,
      is_direct_airline: isAirline,
    });
  });

  // If there is one flight and multiple booking options,
  // attach the booking options to that flight.
  if (flights.length === 1 && bookingOptions.length > 0) {
    flights[0].booking_options = bookingOptions;
  }

  return { flights };
}



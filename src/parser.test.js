import { describe, it, expect } from "@jest/globals";
import { parseSearchFlights, parseBookingFlights } from "./parser.js";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeSearchHtml(items, { best = true } = {}) {
  const jsname = best ? "IWWDBc" : "YdtKid";
  const lis = items
    .map(
      (itinerary) =>
        `<li><div data-travelimpactmodelwebsiteurl="https://example.com?itinerary=${itinerary}"></div></li>`
    )
    .join("\n");
  return `<div jsname="${jsname}"><ul class="Rk10dc">${lis}</ul></div>`;
}

function seg(o, d, al, fn, date) {
  return `${o}-${d}-${al}-${fn}-${date.replace(/-/g, "")}`;
}

// ── parseSearchFlights ────────────────────────────────────────────────────

describe("parseSearchFlights", () => {
  it("returns empty flights for empty HTML", () => {
    expect(parseSearchFlights("").flights).toHaveLength(0);
  });

  it("returns empty flights when no matching containers", () => {
    expect(parseSearchFlights("<div>no flights here</div>").flights).toHaveLength(0);
  });

  it("returns empty flights when li has no url attribute", () => {
    const html = `<div jsname="IWWDBc"><ul class="Rk10dc"><li><div>no url</div></li></ul></div>`;
    expect(parseSearchFlights(html).flights).toHaveLength(0);
  });

  it("parses a single one-segment flight", () => {
    const html = makeSearchHtml([seg("JFK", "LAX", "AA", "100", "2026-06-15")]);
    const { flights } = parseSearchFlights(html);
    expect(flights).toHaveLength(1);
    expect(flights[0].segments).toHaveLength(1);
    const s = flights[0].segments[0];
    expect(s.origin_airport).toBe("JFK");
    expect(s.destination_airport).toBe("LAX");
    expect(s.airline_code).toBe("AA");
    expect(s.flight_number).toBe("100");
    expect(s.departure_date).toBe("2026-06-15");
  });

  it("parses a multi-segment (connecting) flight", () => {
    const itinerary = [
      seg("JFK", "ORD", "AA", "100", "2026-06-15"),
      seg("ORD", "LAX", "AA", "200", "2026-06-15"),
    ].join(",");
    const html = makeSearchHtml([itinerary]);
    const { flights } = parseSearchFlights(html);
    expect(flights[0].segments).toHaveLength(2);
    expect(flights[0].segments[1].origin_airport).toBe("ORD");
    expect(flights[0].segments[1].destination_airport).toBe("LAX");
  });

  it("marks flights from the first block as is_best=true", () => {
    const html = makeSearchHtml([seg("JFK", "LAX", "AA", "100", "2026-06-15")], { best: true });
    expect(parseSearchFlights(html).flights[0].is_best).toBe(true);
  });

  it("marks flights from the second block as is_best=false", () => {
    // The second container (YdtKid) is at index 1, so isBest = false.
    // We need a first block (IWWDBc) so that YdtKid lands at index 1.
    const firstBlock = makeSearchHtml([seg("JFK", "LAX", "AA", "100", "2026-06-15")], { best: true });
    const secondBlock = makeSearchHtml([seg("JFK", "LAX", "DL", "500", "2026-06-15")], { best: false });
    const { flights } = parseSearchFlights(firstBlock + secondBlock);
    const dlFlight = flights.find((f) => f.segments[0].airline_code === "DL");
    expect(dlFlight.is_best).toBe(false);
  });

  it("deduplicates identical itineraries", () => {
    const s = seg("JFK", "LAX", "AA", "100", "2026-06-15");
    const html = makeSearchHtml([s, s]);
    expect(parseSearchFlights(html).flights).toHaveLength(1);
  });

  it("keeps best version when duplicate appears in both blocks", () => {
    const s = seg("JFK", "LAX", "AA", "100", "2026-06-15");
    const bestBlock = `<div jsname="IWWDBc"><ul class="Rk10dc"><li><div data-travelimpactmodelwebsiteurl="https://example.com?itinerary=${s}"></div></li></ul></div>`;
    const otherBlock = `<div jsname="YdtKid"><ul class="Rk10dc"><li><div data-travelimpactmodelwebsiteurl="https://example.com?itinerary=${s}"></div></li></ul></div>`;
    const { flights } = parseSearchFlights(bestBlock + otherBlock);
    expect(flights).toHaveLength(1);
    expect(flights[0].is_best).toBe(true);
  });

  it("parses multiple distinct flights", () => {
    const html = makeSearchHtml([
      seg("JFK", "LAX", "AA", "100", "2026-06-15"),
      seg("JFK", "LAX", "DL", "500", "2026-06-15"),
    ]);
    expect(parseSearchFlights(html).flights).toHaveLength(2);
  });

  it("uses NZRfve div as fallback for the url attribute", () => {
    const s = seg("JFK", "LAX", "AA", "100", "2026-06-15");
    const html = `<div jsname="IWWDBc"><ul class="Rk10dc"><li><div class="NZRfve" data-travelimpactmodelwebsiteurl="https://example.com?itinerary=${s}"></div></li></ul></div>`;
    const { flights } = parseSearchFlights(html);
    expect(flights).toHaveLength(1);
    expect(flights[0].segments[0].origin_airport).toBe("JFK");
  });

  it("formats departure_date from YYYYMMDD to YYYY-MM-DD", () => {
    const html = makeSearchHtml([seg("JFK", "LAX", "AA", "100", "2026-06-15")]);
    expect(parseSearchFlights(html).flights[0].segments[0].departure_date).toBe("2026-06-15");
  });
});

// ── parseBookingFlights ───────────────────────────────────────────────────

function makeBookingHtml({ segments = [], bookingOptions = [], totalDuration = null } = {}) {
  const segHtml = segments
    .map(
      ({ origin, destination, depTime, arrTime, airline, flightCode, seatClass, aircraft, duration }) => `
      <div jscontroller="GQaSVc">
        <div class="ZHa2lc tdMWuf y52p7d">${origin ?? ""}</div>
        <div class="FY5t7d tdMWuf y52p7d">${destination ?? ""}</div>
        ${depTime ? `<div aria-label="Departure time">${depTime}</div>` : ""}
        ${arrTime ? `<div aria-label="Arrival time">${arrTime}</div>` : ""}
        <div class="MX5RWe sSHqwe y52p7d">
          <span class="Xsgmwe">${airline ?? ""}</span>
          <span class="Xsgmwe">${flightCode ?? ""}</span>
          <span class="Xsgmwe">${seatClass ?? ""}</span>
          <span class="Xsgmwe">${aircraft ?? ""}</span>
        </div>
        ${duration ? `<div class="P102Lb sSHqwe y52p7d">Travel time: ${duration}</div>` : ""}
      </div>`
    )
    .join("\n");

  const durationHtml = totalDuration
    ? `<div aria-label="Total duration">${totalDuration}</div>`
    : "";

  const optionsHtml = bookingOptions
    .map(
      ({ name, price, isAirline }) => `
      <div class="gN1nAc">
        <div class="ogfYpf AdWm1c">${name}</div>
        <div class="ScwYP">${price ?? ""}</div>
        ${isAirline ? '<div class="sSHqwe wZlgrf EA71Tc"></div>' : ""}
      </div>`
    )
    .join("\n");

  const flightBlock =
    segments.length > 0
      ? `<div jscontroller="Lqaaf">${durationHtml}${segHtml}</div>`
      : "";

  return flightBlock + optionsHtml;
}

describe("parseBookingFlights", () => {
  it("returns empty flights for empty HTML", () => {
    expect(parseBookingFlights("").flights).toHaveLength(0);
  });

  it("returns empty flights when no jscontroller=Lqaaf blocks", () => {
    const html = `<div class="gN1nAc"><div class="ogfYpf AdWm1c">Delta</div></div>`;
    expect(parseBookingFlights(html).flights).toHaveLength(0);
  });

  it("parses a single segment flight", () => {
    const html = makeBookingHtml({
      segments: [{ origin: "JFK", destination: "LAX", airline: "Delta Air Lines", flightCode: "DL500" }],
    });
    const { flights } = parseBookingFlights(html);
    expect(flights).toHaveLength(1);
    expect(flights[0].segments).toHaveLength(1);
    expect(flights[0].segments[0].origin).toBe("JFK");
    expect(flights[0].segments[0].destination).toBe("LAX");
    expect(flights[0].segments[0].airline).toBe("Delta Air Lines");
    expect(flights[0].segments[0].flight_code).toBe("DL500");
  });

  it("parses seat_class and aircraft from segment spans", () => {
    const html = makeBookingHtml({
      segments: [{ origin: "JFK", destination: "LAX", airline: "AA", flightCode: "AA100", seatClass: "Economy", aircraft: "Boeing 737" }],
    });
    const seg = parseBookingFlights(html).flights[0].segments[0];
    expect(seg.seat_class).toBe("Economy");
    expect(seg.aircraft).toBe("Boeing 737");
  });

  it("parses total_duration", () => {
    const html = makeBookingHtml({
      segments: [{ origin: "JFK", destination: "LAX" }],
      totalDuration: "5 hr 30 min",
    });
    expect(parseBookingFlights(html).flights[0].total_duration).toBe("5 hr 30 min");
  });

  it("parses booking options and attaches them to all flights", () => {
    const html = makeBookingHtml({
      segments: [{ origin: "JFK", destination: "LAX" }],
      bookingOptions: [
        { name: "Book with Delta", price: "$299", isAirline: true },
        { name: "Expedia", price: "$315", isAirline: false },
      ],
    });
    const { flights } = parseBookingFlights(html);
    expect(flights[0].booking_options).toHaveLength(2);
    expect(flights[0].booking_options[0].name).toBe("Book with Delta");
    expect(flights[0].booking_options[0].price).toBe("$299");
    expect(flights[0].booking_options[0].is_direct_airline).toBe(true);
    expect(flights[0].booking_options[1].is_direct_airline).toBe(false);
  });

  it("strips leading 'from ' from price", () => {
    const html = makeBookingHtml({
      segments: [{ origin: "JFK", destination: "LAX" }],
      bookingOptions: [{ name: "Delta", price: "from $199" }],
    });
    expect(parseBookingFlights(html).flights[0].booking_options[0].price).toBe("$199");
  });

  it("skips booking options starting with 'Call '", () => {
    const callOptionHtml = `<div class="gN1nAc"><div class="ogfYpf AdWm1c">Call Delta</div><div class="ScwYP">$199</div></div>`;
    const html = makeBookingHtml({ segments: [{ origin: "JFK", destination: "LAX" }] }) + callOptionHtml;
    const { flights } = parseBookingFlights(html);
    expect(flights[0].booking_options).toHaveLength(0);
  });

  it("parses travel time and strips 'Travel time: ' prefix", () => {
    const html = makeBookingHtml({
      segments: [{ origin: "JFK", destination: "LAX", duration: "5 hr 30 min" }],
    });
    expect(parseBookingFlights(html).flights[0].segments[0].duration).toBe("5 hr 30 min");
  });

  it("initializes layovers as empty array", () => {
    const html = makeBookingHtml({ segments: [{ origin: "JFK", destination: "LAX" }] });
    expect(parseBookingFlights(html).flights[0].layovers).toEqual([]);
  });

  it("does not attach booking options when there are none", () => {
    const html = makeBookingHtml({ segments: [{ origin: "JFK", destination: "LAX" }] });
    expect(parseBookingFlights(html).flights[0].booking_options).toEqual([]);
  });

  it("attaches same booking options to multiple flight blocks", () => {
    const block = `<div jscontroller="Lqaaf"><div jscontroller="GQaSVc"><div class="ZHa2lc tdMWuf y52p7d">JFK</div><div class="FY5t7d tdMWuf y52p7d">LAX</div></div></div>`;
    const optionHtml = `<div class="gN1nAc"><div class="ogfYpf AdWm1c">Delta</div><div class="ScwYP">$299</div></div>`;
    const { flights } = parseBookingFlights(block + block + optionHtml);
    expect(flights).toHaveLength(2);
    expect(flights[0].booking_options).toHaveLength(1);
    expect(flights[1].booking_options).toHaveLength(1);
  });
});

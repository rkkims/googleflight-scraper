import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { normalizeInput } from "./input_normalize.js";

// ── Date helpers ──────────────────────────────────────────────────────────

// Return a date string N days from today (UTC)
function daysFromNow(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

// ── Required fields ───────────────────────────────────────────────────────

describe("normalizeInput — required fields", () => {
  it("throws when origin is missing", () => {
    expect(() => normalizeInput({ destination: "LAX", departure_date: daysFromNow(30) })).toThrow(
      "Missing required origin or destination"
    );
  });

  it("throws when destination is missing", () => {
    expect(() => normalizeInput({ origin: "JFK", departure_date: daysFromNow(30) })).toThrow(
      "Missing required origin or destination"
    );
  });
});

// ── Date parsing ──────────────────────────────────────────────────────────

describe("normalizeInput — date parsing", () => {
  const base = { origin: "JFK", destination: "LAX" };
  const future = daysFromNow(60);

  it("accepts YYYY-MM-DD format", () => {
    const result = normalizeInput({ ...base, departure_date: future });
    expect(result.itinerary[0].travel_date).toBe(future);
  });

  it("accepts YYYY/MM/DD format", () => {
    const slashed = future.replace(/-/g, "/");
    const result = normalizeInput({ ...base, departure_date: slashed });
    expect(result.itinerary[0].travel_date).toBe(future);
  });

  it("accepts MM/DD/YYYY format", () => {
    const [y, m, d] = future.split("-");
    const result = normalizeInput({ ...base, departure_date: `${m}/${d}/${y}` });
    expect(result.itinerary[0].travel_date).toBe(future);
  });

  it("accepts ISO datetime and strips time component", () => {
    const result = normalizeInput({ ...base, departure_date: `${future}T10:30:00` });
    expect(result.itinerary[0].travel_date).toBe(future);
  });

  it("throws on invalid date format", () => {
    expect(() => normalizeInput({ ...base, departure_date: "not-a-date" })).toThrow(
      "Invalid date format"
    );
  });

  it("defaults to today+30 when departure_date is missing", () => {
    const result = normalizeInput({ ...base });
    expect(result.itinerary[0].travel_date).toBe(daysFromNow(30));
  });

  it("bumps past departure date to today+30", () => {
    const result = normalizeInput({ ...base, departure_date: "2020-01-01" });
    expect(result.itinerary[0].travel_date).toBe(daysFromNow(30));
  });
});

// ── Trip type ─────────────────────────────────────────────────────────────

describe("normalizeInput — trip type", () => {
  const base = { origin: "JFK", destination: "LAX", departure_date: daysFromNow(30) };

  it("defaults to trip_type_one_way with no return_date or trip", () => {
    expect(normalizeInput(base).trip_type).toBe("trip_type_one_way");
  });

  it("uses trip_type_round when return_date is provided", () => {
    const result = normalizeInput({ ...base, return_date: daysFromNow(37) });
    expect(result.trip_type).toBe("trip_type_round");
  });

  it("respects explicit trip field (converts dashes to underscores)", () => {
    const result = normalizeInput({ ...base, trip: "trip-type-one-way" });
    expect(result.trip_type).toBe("trip_type_one_way");
  });

  it("bumps return_date to departure+7 when return is before departure", () => {
    const dep = daysFromNow(30);
    const result = normalizeInput({ ...base, departure_date: dep, return_date: "2020-01-01" });
    expect(result.itinerary[1].travel_date).toBe(daysFromNow(37));
  });
});

// ── Passengers ────────────────────────────────────────────────────────────

describe("normalizeInput — passengers", () => {
  const base = { origin: "JFK", destination: "LAX", departure_date: daysFromNow(30) };

  it("defaults to 1 adult, 0 children, 0 infants", () => {
    expect(normalizeInput(base).passengers).toEqual({ adult: 1, child: 0, infant: 0 });
  });

  it("uses provided passenger counts", () => {
    const result = normalizeInput({ ...base, passengers: { adult: 2, child: 1, infant: 1 } });
    expect(result.passengers).toEqual({ adult: 2, child: 1, infant: 1 });
  });
});

// ── Cabin class ───────────────────────────────────────────────────────────

describe("normalizeInput — cabin class", () => {
  const base = { origin: "JFK", destination: "LAX", departure_date: daysFromNow(30) };

  it("defaults to economy", () => {
    expect(normalizeInput(base).cabin_class).toBe("economy");
  });

  it("uses seat field", () => {
    expect(normalizeInput({ ...base, seat: "Business" }).cabin_class).toBe("business");
  });

  it("uses cabin_class field", () => {
    expect(normalizeInput({ ...base, cabin_class: "FIRST" }).cabin_class).toBe("first");
  });

  it("seat takes priority over cabin_class", () => {
    expect(normalizeInput({ ...base, seat: "Business", cabin_class: "Economy" }).cabin_class).toBe("business");
  });
});

// ── Itinerary structure ───────────────────────────────────────────────────

describe("normalizeInput — itinerary", () => {
  const dep = daysFromNow(30);
  const ret = daysFromNow(37);
  const base = { origin: "JFK", destination: "LAX", departure_date: dep };

  it("builds single-leg itinerary for one-way trip", () => {
    const result = normalizeInput(base);
    expect(result.itinerary).toHaveLength(1);
    expect(result.itinerary[0].origin.code).toBe("JFK");
    expect(result.itinerary[0].destination.code).toBe("LAX");
    expect(result.itinerary[0].travel_date).toBe(dep);
  });

  it("builds two-leg itinerary for round trip (return leg swaps origin/dest)", () => {
    const result = normalizeInput({ ...base, return_date: ret });
    expect(result.itinerary).toHaveLength(2);
    expect(result.itinerary[1].origin.code).toBe("LAX");
    expect(result.itinerary[1].destination.code).toBe("JFK");
    expect(result.itinerary[1].travel_date).toBe(ret);
  });
});

// ── fixed_flights ─────────────────────────────────────────────────────────

describe("normalizeInput — fixed_flights", () => {
  const dep = daysFromNow(30);
  const base = { origin: "JFK", destination: "LAX", departure_date: dep };

  it("normalizes outbound segment field names", () => {
    const result = normalizeInput({
      ...base,
      fixed_flights: {
        outbound: [{ origin_airport: "JFK", destination_airport: "LAX", departure_date: dep, airline_code: "AA", flight_number: "100" }],
      },
    });
    const seg = result.itinerary[0].segments[0];
    expect(seg.origin_airport).toBe("JFK");
    expect(seg.destination_airport).toBe("LAX");
    expect(seg.airline_code).toBe("AA");
    expect(seg.flight_number).toBe("100");
  });

  it("accepts legacy 'origin'/'destination' segment field names", () => {
    const result = normalizeInput({
      ...base,
      fixed_flights: {
        outbound: [{ origin: "JFK", destination: "LAX", departure_date: dep }],
      },
    });
    const seg = result.itinerary[0].segments[0];
    expect(seg.origin_airport).toBe("JFK");
    expect(seg.destination_airport).toBe("LAX");
  });

  it("throws when return segments are provided without outbound", () => {
    expect(() =>
      normalizeInput({
        ...base,
        return_date: daysFromNow(37),
        fixed_flights: { return: [{ origin: "LAX", destination: "JFK", departure_date: daysFromNow(37) }] },
      })
    ).toThrow("'return' segments cannot exist without 'outbound'");
  });

  it("throws when fixed_flights is an array", () => {
    expect(() => normalizeInput({ ...base, fixed_flights: [] })).toThrow(
      "fixed_flights must be a dict"
    );
  });
});

import { describe, it, expect } from "@jest/globals";
import { serializeBase64Url } from "./flight_serializer.js";

// ── Helpers ───────────────────────────────────────────────────────────────

function oneWay({ passengers, cabin_class, segments = [] } = {}) {
  return {
    trip_type: "trip_type_one_way",
    cabin_class: cabin_class ?? "economy",
    passengers: passengers ?? { adult: 1, child: 0, infant: 0 },
    itinerary: [
      {
        travel_date: "2026-06-15",
        origin: { code: "JFK" },
        destination: { code: "LAX" },
        segments,
      },
    ],
  };
}

function roundTrip() {
  return {
    trip_type: "trip_type_round",
    cabin_class: "economy",
    passengers: { adult: 1, child: 0, infant: 0 },
    itinerary: [
      { travel_date: "2026-06-15", origin: { code: "JFK" }, destination: { code: "LAX" }, segments: [] },
      { travel_date: "2026-06-22", origin: { code: "LAX" }, destination: { code: "JFK" }, segments: [] },
    ],
  };
}

// ── Output format ─────────────────────────────────────────────────────────

describe("serializeBase64Url — output format", () => {
  it("returns a non-empty string", async () => {
    const result = await serializeBase64Url(oneWay());
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns valid base64url (no +, /, or = characters)", async () => {
    const result = await serializeBase64Url(oneWay());
    expect(result).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("produces different output for different inputs", async () => {
    const a = await serializeBase64Url(oneWay({ cabin_class: "economy" }));
    const b = await serializeBase64Url(oneWay({ cabin_class: "business" }));
    expect(a).not.toBe(b);
  });

  it("produces consistent output for the same input", async () => {
    const input = oneWay();
    const a = await serializeBase64Url(input);
    const b = await serializeBase64Url(input);
    expect(a).toBe(b);
  });
});

// ── Trip types ────────────────────────────────────────────────────────────

describe("serializeBase64Url — trip types", () => {
  it("serializes trip_type_one_way without throwing", async () => {
    await expect(serializeBase64Url(oneWay())).resolves.toBeDefined();
  });

  it("serializes trip_type_round without throwing", async () => {
    await expect(serializeBase64Url(roundTrip())).resolves.toBeDefined();
  });

  it("produces different output for one-way vs round-trip", async () => {
    const a = await serializeBase64Url(oneWay());
    const b = await serializeBase64Url(roundTrip());
    expect(a).not.toBe(b);
  });
});

// ── Passengers ────────────────────────────────────────────────────────────

describe("serializeBase64Url — passengers", () => {
  it("encodes 2 adults differently from 1 adult", async () => {
    const one = await serializeBase64Url(oneWay({ passengers: { adult: 1, child: 0, infant: 0 } }));
    const two = await serializeBase64Url(oneWay({ passengers: { adult: 2, child: 0, infant: 0 } }));
    expect(one).not.toBe(two);
  });

  it("encodes a child passenger differently from no children", async () => {
    const without = await serializeBase64Url(oneWay({ passengers: { adult: 1, child: 0, infant: 0 } }));
    const withChild = await serializeBase64Url(oneWay({ passengers: { adult: 1, child: 1, infant: 0 } }));
    expect(without).not.toBe(withChild);
  });

  it("encodes an infant differently from no infants", async () => {
    const without = await serializeBase64Url(oneWay({ passengers: { adult: 1, child: 0, infant: 0 } }));
    const withInfant = await serializeBase64Url(oneWay({ passengers: { adult: 1, child: 0, infant: 1 } }));
    expect(without).not.toBe(withInfant);
  });

  it("defaults to 1 adult when passengers is not provided", async () => {
    const withDefault = await serializeBase64Url({ ...oneWay(), passengers: undefined });
    const explicit = await serializeBase64Url(oneWay({ passengers: { adult: 1 } }));
    expect(withDefault).toBe(explicit);
  });
});

// ── Cabin class ───────────────────────────────────────────────────────────

describe("serializeBase64Url — cabin class", () => {
  const classes = ["economy", "premium economy", "business", "first"];

  it.each(classes)("serializes '%s' without throwing", async (cabin_class) => {
    await expect(serializeBase64Url(oneWay({ cabin_class }))).resolves.toBeDefined();
  });

  it("produces distinct outputs for all four cabin classes", async () => {
    const results = await Promise.all(classes.map((c) => serializeBase64Url(oneWay({ cabin_class: c }))));
    const unique = new Set(results);
    expect(unique.size).toBe(4);
  });
});

// ── Segments (price-check mode) ───────────────────────────────────────────

describe("serializeBase64Url — fixed segments", () => {
  const seg = {
    origin_airport: "JFK",
    destination_airport: "LAX",
    departure_date: "2026-06-15",
    airline_code: "AA",
    flight_number: "100",
  };

  it("serializes a flight with fixed segments without throwing", async () => {
    await expect(serializeBase64Url(oneWay({ segments: [seg] }))).resolves.toBeDefined();
  });

  it("produces different output with vs without segments", async () => {
    const withSeg = await serializeBase64Url(oneWay({ segments: [seg] }));
    const withoutSeg = await serializeBase64Url(oneWay({ segments: [] }));
    expect(withSeg).not.toBe(withoutSeg);
  });
});

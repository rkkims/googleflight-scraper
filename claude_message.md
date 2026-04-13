# Architecture: Kayak + Google Flights Combined Approach

## Architecture Overview

```
Kayak Scraper (1 page load)
   → [N combined itineraries with airline/flight#]
   → deduplicate by (airline_code, flight_number, date)
   → Google Flights price-check (1 page load each)
   → aggregated results
```

---

## Key Issues to Solve First

### 1. Kayak parser doesn't emit airline_code / flight_number

The Kayak `parser.js:segmentFarings` likely contains carrier/flight data in the raw API response, but the current parser only extracts `cabin`, `cabinCode`, and `amenities`. You'd need to add `airline_code` and `flight_number` to each segment — without that, the Google Flights price-check mode can't be triggered.

Check your raw Kayak API response to confirm the field names (likely something like `carrierCode` and `flightNumber` in `segmentFarings`).

### 2. Round-trip structure mismatch

Kayak returns **combined itineraries** (outbound + return as one price), while Google Flights price-check input takes `fixed_flights.outbound` and `fixed_flights.return` separately. The mapping is straightforward: `legs[0].segments → fixed_flights.outbound`, `legs[1].segments → fixed_flights.return`.

---

## Orchestration Options

### Option A: Third "coordinator" Apify actor (recommended)
A lightweight actor that:
1. Calls `Actor.call('your/kayak-scraper', input)` → gets dataset
2. Deduplicates by `(airline_code, flight_number, date)` per leg
3. For each unique itinerary, calls `Actor.call('your/googleflight-scraper', priceCheckInput)`
4. Merges and pushes final results

This is the cleanest Apify-native approach. Each actor stays single-purpose.

### Option B: Kayak actor as orchestrator
After `Actor.pushData(result.flights)`, loop over results and call the Google Flights actor inline. Works, but couples two scrapers tightly and makes Kayak harder to use standalone.

### Option C: External script / cron
Run Kayak, pull its dataset via Apify API, then fan out Google Flights calls. More infrastructure but maximum flexibility (e.g., filter by price before spending on Google Flights).

---

## Critical Optimization: Deduplicate Before Calling Google Flights

Kayak returns the same flight combo from multiple agents at different prices. If you call Google Flights for every Kayak result, you pay for duplicate price checks. Deduplicate on the itinerary signature before fanning out:

```js
const seen = new Set();
const unique = kayakFlights.filter(flight => {
  const key = flight.legs.map(leg =>
    leg.segments.map(s => `${s.airline_code}${s.flight_number}`).join('-')
  ).join('|');
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
```

---

## Cost Model Comparison

| Scenario | Page Loads |
|---|---|
| Current Google Flights (3 out × 3 return) | 1 + 3 + 9 = **13** |
| New: Kayak + price-check for top 5 itineraries | 1 + **5** = **6** |
| New: Kayak + price-check for top 10 | 1 + **11** |

The break-even is roughly: if Kayak returns fewer unique itineraries than the current `max_outbound × max_return`, you save page loads. In practice, you'd only price-check the top N cheapest Kayak itineraries.

---

## Recommended Next Steps

1. **Inspect a raw Kayak API response** to find the airline/flight number field names in `segmentFarings`
2. **Update `kayak-scraper/src/parser.js`** to include `airline_code` + `flight_number` per segment
3. **Build the coordinator actor** with deduplication + `Actor.call()` fan-out
4. **Add a `max_price_checks` input** to the coordinator to cap Google Flights calls (e.g., only check the 5 cheapest itineraries from Kayak)

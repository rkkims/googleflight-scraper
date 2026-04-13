# Cost Reduction Advice

## Cost Drivers

Apify bills on memory × time (compute units) + proxy requests per page.

With default settings (`max_outbound=3`, `max_return=3`), each run does:
- 1 outbound search page
- 3 return search pages
- 9 booking pages (3 outbound × 3 return)

= **13 browser page loads**, each waiting up to 60s for XHR, each consuming a proxy request.

Plus **~16 Python subprocess spawns** per run (input normalization + TFS serialization for every flight combination), each one starts a fresh Python interpreter and imports protobuf.

---

## Suggestions, Ranked by Impact

### 1. Parse prices on the search page and skip booking pages
**Highest impact.** `parseSearchFlights` currently only extracts flight segments — but the search results page already shows prices for each flight. If you parse prices there, you can skip the 9 booking page loads entirely and just output the result directly.

That's a reduction from 13 page loads → 4. **~70% fewer proxy requests and browser time.**

The tradeoff is you lose the per-agent breakdown (e.g. "Book with Expedia for $X"), and only get the headline price Google shows. Whether that's acceptable depends on what the output is used for.

### 2. Replace Python subprocesses with a Node.js protobuf library
**Second highest impact.** The entire Python layer (`flight_serializer.py`, `input_normalize.py`) exists just to build and encode a Protobuf message. `protobufjs` can do the same thing natively in Node.js using the existing `.proto` file.

Eliminating the Python subprocesses would:
- Remove ~16 process spawns per run (each starts a Python interpreter + imports)
- Simplify the Docker image (no Python, pip, grpcio-tools, protobuf) → faster cold starts and a smaller image

### 3. Reduce memory from 4096 MB to 1024–2048 MB
**Direct cost multiplier.** Playwright + Chromium can typically run comfortably in 1–2 GB. The current 4096 MB allocation is likely over-provisioned. Halving to 2048 MB halves compute unit cost. Worth testing at 1024 MB too.

### 4. Reduce `maxConcurrency`
Currently set to 10, meaning up to 10 browser instances can run simultaneously. Each concurrent browser multiplies memory pressure. With 13 sequential page loads per run, concurrency of 3–5 is likely sufficient and would let you safely reduce the memory allocation.

### 5. Filter before visiting booking pages
If you keep the booking page step, add a price filter on the search page: only follow up on the N cheapest flights rather than the first N flights listed. This doesn't reduce page count but improves the quality/cost ratio of what's being fetched.

---

## Summary Table

| Change | Reduces | Effort |
|---|---|---|
| Parse prices from search page | Proxy + browser time (~70%) | Medium |
| Replace Python with `protobufjs` | Subprocess overhead + image size | Medium |
| Lower memory to 2048 MB | Compute units (50%) | Low |
| Lower `maxConcurrency` | Memory pressure | Low |
| Filter before booking | Wasted booking page loads | Low |

## Completed

- **#2** Replace Python with `protobufjs` — done
- **#3** Reduce memory to 2048 MB — done
- **#4** Reduce `maxConcurrency` to 3 — done
- **#5** Remove dead Python files — done
- **#6** Replace `waitForTimeout` with `waitForSelector` — done
- **#7** Reduce `maxRequestRetries` to 2 — done
- **#8** Add `.dockerignore` — done
- **#9** Replace manual XHR listeners with `page.waitForResponse()` — done
- **#10** Install only Chromium in Dockerfile — done
- **#11** Price check mode — done (skip search entirely for known flights; 1 page load vs. 13)

## Verdict on Original Strategy

Original advice #1 (skip booking pages by parsing search prices) was **superseded** by the price check mode idea. Skipping booking pages would have broken the per-agent breakdown (direct airline vs. third-party), which is the core value of the actor. Instead, price check mode achieves the same page-load reduction (1 vs. 13) for users who already know their specific flights, while preserving full booking option data.

## Status

All meaningful optimizations have been applied. No further cost reduction changes are identified.

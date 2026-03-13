export function normalizeInput(raw) {
  function parseDate(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).trim();

    // YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    // MM/DD/YYYY
    const usMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (usMatch) return `${usMatch[3]}-${usMatch[1]}-${usMatch[2]}`;

    // ISO with time component
    if (s.includes("T")) return s.split("T")[0];

    throw new Error(`Invalid date format: ${dateStr}`);
  }

  const origin = raw.origin;
  const destination = raw.destination;
  if (!origin || !destination) {
    throw new Error("Missing required origin or destination airport code.");
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let departureDateStr = parseDate(raw.departure_date);
  let returnDateStr = parseDate(raw.return_date);

  if (!departureDateStr) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + 30);
    departureDateStr = d.toISOString().split("T")[0];
  } else {
    const depDt = new Date(departureDateStr + "T00:00:00Z");
    if (depDt < today) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + 30);
      departureDateStr = d.toISOString().split("T")[0];
    }
  }

  if (returnDateStr) {
    const retDt = new Date(returnDateStr + "T00:00:00Z");
    const depDt = new Date(departureDateStr + "T00:00:00Z");
    if (retDt < depDt) {
      const d = new Date(depDt);
      d.setUTCDate(d.getUTCDate() + 7);
      returnDateStr = d.toISOString().split("T")[0];
    }
  }

  let tripType;
  if (raw.trip) {
    tripType = raw.trip.replace(/-/g, "_").toLowerCase();
  } else if (returnDateStr) {
    tripType = "trip_type_round";
  } else {
    tripType = "trip_type_one_way";
  }

  const cabinClass = (raw.seat || raw.cabin_class || "economy").toLowerCase();

  const pax = raw.passengers || {};
  const passengers = {
    adult: pax.adult ?? 1,
    child: pax.child ?? 0,
    infant: pax.infant ?? 0,
  };

  const fixedFlights = raw.fixed_flights || {};
  if (typeof fixedFlights !== "object" || Array.isArray(fixedFlights)) {
    throw new Error("fixed_flights must be a dict if provided.");
  }
  const outboundSegments = fixedFlights.outbound || [];
  const returnSegments = fixedFlights.return || [];
  if (returnSegments.length > 0 && outboundSegments.length === 0) {
    throw new Error("Invalid input: 'return' segments cannot exist without 'outbound'.");
  }

  function normalizeSegment(segment) {
    return {
      origin_airport: segment.origin_airport || segment.origin,
      destination_airport: segment.destination_airport || segment.destination,
      departure_date: parseDate(segment.date || segment.flight_date || segment.departure_date),
      airline_code: segment.airline_code,
      flight_number: segment.flight_number,
    };
  }

  const itinerary = [
    {
      travel_date: departureDateStr,
      segments: outboundSegments.filter(Boolean).map(normalizeSegment),
      origin: { code: origin },
      destination: { code: destination },
    },
  ];

  if (returnDateStr) {
    itinerary.push({
      travel_date: returnDateStr,
      segments: returnSegments.filter(Boolean).map(normalizeSegment),
      origin: { code: destination },
      destination: { code: origin },
    });
  }

  return {
    itinerary,
    cabin_class: cabinClass,
    passengers,
    trip_type: tripType,
  };
}

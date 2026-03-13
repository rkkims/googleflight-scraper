import protobuf from "protobufjs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const protoPath = join(__dirname, "flights.proto");

let _root;
async function getRoot() {
  if (!_root) _root = await protobuf.load(protoPath);
  return _root;
}

const TRIP_TYPE_MAP = {
  trip_type_round: 1,
  trip_type_one_way: 2,
  trip_type_multi_city: 3,
};

const CABIN_CLASS_MAP = {
  economy: 1,
  "premium economy": 2,
  business: 3,
  first: 4,
};

export async function serializeBase64Url(canonical) {
  const root = await getRoot();
  const FlightSearchRequest = root.lookupType("googleflightsearch.FlightSearchRequest");

  const payload = {
    tripType: TRIP_TYPE_MAP[canonical.trip_type] ?? 0,
    cabinClass: CABIN_CLASS_MAP[canonical.cabin_class] ?? 0,
    passengerTypes: [],
    itinerary: [],
  };

  const pax = canonical.passengers || { adult: 1 };
  for (let i = 0; i < (pax.adult || 0); i++) payload.passengerTypes.push(1);
  for (let i = 0; i < (pax.child || 0); i++) payload.passengerTypes.push(2);
  for (let i = 0; i < (pax.infant || 0); i++) payload.passengerTypes.push(4); // INFANT_LAP

  for (const leg of canonical.itinerary || []) {
    const tripLeg = {
      travelDate: leg.travel_date || "",
      origin: { code: leg.origin?.code || "" },
      destination: { code: leg.destination?.code || "" },
      segments: [],
    };

    if (leg.max_connections != null) tripLeg.maxConnections = leg.max_connections;
    if (leg.preferred_airlines?.length) tripLeg.preferredAirlines = leg.preferred_airlines;

    for (const seg of leg.segments || []) {
      tripLeg.segments.push({
        originAirport: seg.origin_airport || "",
        departureDate: seg.departure_date || "",
        destinationAirport: seg.destination_airport || "",
        airlineCode: seg.airline_code || "",
        flightNumber: seg.flight_number || "",
      });
    }

    payload.itinerary.push(tripLeg);
  }

  const err = FlightSearchRequest.verify(payload);
  if (err) throw new Error(`Protobuf verification failed: ${err}`);

  const msg = FlightSearchRequest.create(payload);
  const buffer = FlightSearchRequest.encode(msg).finish();
  return Buffer.from(buffer).toString("base64url");
}

from google.protobuf.json_format import MessageToDict
import flights_pb2 as pb
from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import datetime
import json
import sys

class FlightSerializer:
    @staticmethod
    def build_payload(canonical: dict) -> pb.FlightSearchRequest:
        msg = pb.FlightSearchRequest()

        # --- Trip Type ---
        trip_type_map = {
            "trip_type_round": pb.TripType.TRIP_TYPE_ROUND,
            "trip_type_one_way": pb.TripType.TRIP_TYPE_ONE_WAY,
            "trip_type_multi_city": pb.TripType.TRIP_TYPE_MULTI_CITY,
        }
        msg.trip_type = trip_type_map.get(
            canonical.get("trip_type", "").lower(), pb.TripType.TRIP_TYPE_UNSPECIFIED
        )

        # --- Cabin Class ---
        cabin_class_map = {
            "economy": pb.CabinClass.CABIN_CLASS_ECONOMY,
            "premium economy": pb.CabinClass.CABIN_CLASS_PREMIUM_ECONOMY,
            "business": pb.CabinClass.CABIN_CLASS_BUSINESS,
            "first": pb.CabinClass.CABIN_CLASS_FIRST,
        }
        msg.cabin_class = cabin_class_map.get(
            canonical.get("cabin_class", "").lower(), pb.CabinClass.CABIN_CLASS_UNSPECIFIED
        )

        # --- Passenger Types ---
        pax = canonical.get("passengers", {"adult": 1})
        passenger_types = (
            [pb.PassengerType.PASSENGER_TYPE_ADULT] * pax.get("adult", 0)
            + [pb.PassengerType.PASSENGER_TYPE_CHILD] * pax.get("child", 0)
            + [pb.PassengerType.PASSENGER_TYPE_INFANT_LAP] * pax.get("infant", 0)
        )
        msg.passenger_types.extend(passenger_types)

        # --- Itinerary / Trip Legs ---
        for leg in canonical.get("itinerary", []):
            trip_leg = msg.itinerary.add()
            trip_leg.travel_date = FlightSerializer._normalize_date(leg.get("travel_date"))
            trip_leg.origin.code = leg.get("origin", {}).get("code", "")
            trip_leg.destination.code = leg.get("destination", {}).get("code", "")

            # Optional metadata
            if "max_connections" in leg:
                trip_leg.max_connections = leg["max_connections"]
            if "preferred_airlines" in leg:
                trip_leg.preferred_airlines.extend(leg["preferred_airlines"])

            # --- Flight Segments ---
            for seg in leg.get("segments", []):
                fs = trip_leg.segments.add()
                fs.origin_airport = seg.get("origin_airport", "")
                fs.destination_airport = seg.get("destination_airport", "")
                fs.departure_date = FlightSerializer._normalize_date(seg.get("departure_date"))
                fs.airline_code = seg.get("airline_code", "")
                fs.flight_number = seg.get("flight_number", "")

        return msg

    @staticmethod
    def _normalize_date(value):
        if isinstance(value, datetime):
            return value.strftime("%Y-%m-%d")
        if isinstance(value, str) and "T" in value:
            return value.split("T")[0]
        return str(value or "")

    @staticmethod
    def serialize(canonical: dict) -> bytes:
        msg = FlightSerializer.build_payload(canonical)
        return msg.SerializeToString()

    @staticmethod
    def serialize_base64url(canonical: dict) -> str:
        encoded = urlsafe_b64encode(FlightSerializer.serialize(canonical)).decode("utf-8")
        return encoded.rstrip("=")

    @staticmethod
    def deserialize(encoded_str: str) -> dict:
        encoded_str += "=" * (-len(encoded_str) % 4)
        raw = urlsafe_b64decode(encoded_str)
        msg = pb.FlightSearchRequest()
        msg.ParseFromString(raw)
        return MessageToDict(msg, preserving_proto_field_name=True)

# --- Main execution block for Apify actor ---
if __name__ == "__main__":
    # This script will be called by the Node.js part of the actor.
    # It reads a JSON object from stdin, which is the actor input.
    input_data = json.load(sys.stdin)
    encoded_tfs = FlightSerializer.serialize_base64url(input_data)
    print(encoded_tfs)
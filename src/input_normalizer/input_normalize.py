from datetime import datetime
from typing import Any, Dict, List


def normalize_input(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize user-provided flight search JSON into canonical structure
    matching FlightSearchRequest (as defined in the updated .proto schema).
    """

    def parse_date(date_str: Any) -> str:
        """Normalize various date formats to 'YYYY-MM-DD'."""
        if not date_str:
            return None
        try:
            return datetime.fromisoformat(str(date_str)).strftime("%Y-%m-%d")
        except ValueError:
            for fmt in ("%Y/%m/%d", "%m/%d/%Y", "%Y-%m-%d"):
                try:
                    return datetime.strptime(str(date_str), fmt).strftime("%Y-%m-%d")
                except ValueError:
                    continue
        raise ValueError(f"Invalid date format: {date_str}")

    # --- Extract core fields ---
    origin = raw.get("origin")
    destination = raw.get("destination")

    if not origin or not destination:
        raise ValueError("Missing required origin or destination airport code.")

    departure_date = parse_date(raw.get("departure_date"))
    return_date = parse_date(raw.get("return_date"))

    # --- Infer trip type ---
    if "trip" in raw:
        trip_type = raw["trip"].replace("-", "_").lower()
    elif return_date:
        trip_type = "trip_type_round"
    else:
        trip_type = "trip_type_one_way"

    # --- Cabin class (seat) ---
    cabin_class = (raw.get("seat") or raw.get("cabin_class") or "economy").lower()

    # --- Passengers (defaults applied) ---
    pax = raw.get("passengers", {})
    passengers = {
        "adult": pax.get("adult", 1),
        "child": pax.get("child", 0),
        "infant": pax.get("infant", 0),
    }

    # --- Extract and validate fixed flights ---
    fixed_flights = raw.get("fixed_flights", {})
    outbound_segments = []
    return_segments = []

    if isinstance(fixed_flights, dict):
        outbound_segments = fixed_flights.get("outbound", [])
        return_segments = fixed_flights.get("return", [])
    else:
        raise ValueError("fixed_flights must be a dict if provided.")

    if return_segments and not outbound_segments:
        raise ValueError("Invalid input: 'return' segments cannot exist without 'outbound'.")

    def normalize_segment(segment: Dict[str, Any]) -> Dict[str, Any]:
        """Convert flight segment into canonical form."""
        return {
            "origin_airport": segment.get("origin_airport"),
            "destination_airport": segment.get("destination_airport"),
            "departure_date": parse_date(segment.get("date")),
            "airline_code": segment.get("airline_code"),
            "flight_number": segment.get("flight_number"),
        }

    itinerary: List[Dict[str, Any]] = []

    # --- Build outbound leg ---
    outbound_leg = {
        "travel_date": departure_date,
        "segments": [normalize_segment(f) for f in outbound_segments if f],
        "origin": {"code": origin},
        "destination": {"code": destination},
    }
    itinerary.append(outbound_leg)

    # --- Build return leg (if applicable) ---
    if return_date:
        itinerary.append({
            "travel_date": return_date,
            "segments": [normalize_segment(f) for f in return_segments if f],
            "origin": {"code": destination},
            "destination": {"code": origin},
        })

    # --- Final normalized structure ---
    canonical = {
        "itinerary": itinerary,
        "cabin_class": cabin_class,
        "passengers": passengers,
        "trip_type": trip_type,
    }

    return canonical


# --- Inline testing block ---
if __name__ == "__main__":
    import sys
    import json
    
    input_json = sys.stdin.read()
    input_data = json.loads(input_json)
    normalized_data = normalize_input(input_data)
    print(json.dumps(normalized_data))
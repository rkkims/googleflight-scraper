# Google Flight Scraper - Input API

This document provides a guide for using the Flight Search Input API. It details the JSON structure for flight searches, which is designed for flexibility by accepting various formats and normalizing them for internal processing.

---

## Getting Started

To perform a flight search, you provide a JSON object with your travel details. The simplest search requires an origin, a destination, and a departure date.

**Example: Simple One-Way Flight**
```json
{
  "origin": "YVR",
  "destination": "NRT",
  "departure_date": "2025-12-03"
}
```
The system automatically handles date format conversion and infers the trip type. For a round trip, simply add a `return_date`.

### 1. Basic Flight Search

For a simple one-way or round-trip flight search, you need to provide the origin, destination, and travel dates.

#### 1.1. Core Fields

| Field | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `origin` | String | The 3-letter IATA code for the origin airport. | **Yes** |
| `destination` | String | The 3-letter IATA code for the destination airport. | **Yes** |
| `departure_date` | String | The departure date. | **Yes** |
| `return_date` | String | The return date. Required for round trips. If omitted, the search is treated as one-way. | No |

#### 1.2. Date Formats

The system accepts dates as strings in the following formats:
*   `YYYY-MM-DD` (e.g., `"2025-12-03"`)
*   `YYYY/MM/DD` (e.g., `"2025/12/03"`)
*   `MM/DD/YYYY` (e.g., `"12/03/2025"`)

#### 1.3. Examples

**One-Way Trip:**
```json
{
  "origin": "YVR",
  "destination": "NRT",
  "departure_date": "2025-12-03"
}
```

**Round Trip:**
```json
{
  "origin": "YVR",
  "destination": "NRT",
  "departure_date": "2025-12-03",
  "return_date": "2025-12-10"
}
```

---

### 2. Specifying Passengers and Cabin Class

You can specify the number and type of passengers, as well as the desired cabin class.

#### 2.1. Passenger and Cabin Fields

| Field | Type | Description | Default |
| :--- | :--- | :--- | :--- |
| `passengers` | Object | An object detailing the number of travelers. | `{"adult": 1}` |
| `seat` / `cabin_class` | String | The desired cabin class. You can use either field name. Accepted values are case-insensitive (e.g., "Economy", "Business", "First"). | `"economy"` |

The `passengers` object has the following structure:

| Field | Type | Description | Default |
| :--- | :--- | :--- | :--- |
| `adult` | Integer | Number of adult passengers. | `1` |
| `child` | Integer | Number of child passengers. | `0` |
| `infant` | Integer | Number of infant passengers. | `0` |

#### 2.2. Example

**Search for 2 adults and 1 child in Business Class:**
```json
{
  "origin": "YVR",
  "destination": "NRT",
  "departure_date": "2025-12-03",
  "return_date": "2025-12-10",
  "passengers": {
    "adult": 2,
    "child": 1
  },
  "seat": "business"
}
```

---

### 3. Advanced Search: Fixed Flights

For complex itineraries where specific flights or layovers are required, you can use the `fixed_flights` field. This is useful for multi-city trips or forcing a particular route.

When `fixed_flights` is used, the `origin` and `destination` at the top level still define the overall journey's start and end points.

#### 3.1. `fixed_flights` Structure

| Field | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `fixed_flights` | Object | An object containing lists of specific flight segments for the outbound and return journeys. | No |

The `fixed_flights` object contains `outbound` and optional `return` legs, which are arrays of flight segments.

| Field | Type | Description |
| :--- | :--- | :--- |
| `outbound` | Array | A list of one or more flight segments for the outbound journey. |
| `return` | Array | A list of one or more flight segments for the return journey. Cannot be used without `outbound`. |

Each **segment** object in the array has the following structure:

| Field | Type | Description |
| :--- | :--- | :--- |
| `origin_airport` | String | The origin airport for this specific segment. |
| `destination_airport` | String | The destination airport for this specific segment. |
| `date` | String | The departure date for this segment. |
| `airline_code` | String | The two-letter IATA code for the airline. |
| `flight_number` | String | The flight number. |

#### 3.2. Example

**Round-trip from YVR to NRT with a specific layover in HKG on the outbound journey:**

In this example, the user wants to fly from YVR to NRT via HKG on the way out, and the return journey from NRT to YVR can be any flight.

```json
{
    "origin": "YVR",
    "destination": "NRT",
    "departure_date": "2025-12-03",
    "return_date": "2025-12-10",
    "fixed_flights": {
        "outbound": [
            {
                "origin_airport": "YVR", 
                "destination_airport": "HKG", 
                "date": "2025-12-03", 
                "airline_code": "HX", 
                "flight_number": "81"
            },
            {
                "origin_airport": "HKG", 
                "destination_airport": "NRT", 
                "date": "2025-12-04", 
                "airline_code": "HX", 
                "flight_number": "604"
            }
        ]
    },
    "passengers": {"adult": 2, "child": 1},
    "seat": "economy"
}
```

---

### 4. Error Handling

The system will raise an error if the input is invalid. Common errors include:
*   Missing `origin` or `destination` fields.
*   Providing `return` segments in `fixed_flights` without `outbound` segments.
*   Using an unrecognized date format.

---

## License

This project is licensed under the Apache License 2.0. See the `LICENSE.txt` file for details.
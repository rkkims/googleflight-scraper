# Google Flights Scraper

This Apify actor scrapes flight information from Google Flights. It can be used to search for one-way and round-trip flights, and retrieve booking details including prices, layovers, and carrier information.

---

## Input Configuration

To perform a flight search, you provide a JSON object with your travel details. The simplest search requires an origin, a destination, and a departure date.

**Example: Simple One-Way Flight**

```json
{
  "origin": "YVR",
  "destination": "NRT",
  "departure_date": "2026-05-11"
}
```

The system automatically handles date format conversion and infers the trip type. For a round trip, simply add a `return_date`.

### 1. Basic Flight Search

For a simple one-way or round-trip flight search, you need to provide the origin, destination, and travel dates.

#### 1.1. Core Fields

| Field            | Type   | Description                                                                              | Required |
| :--------------- | :----- | :--------------------------------------------------------------------------------------- | :------- |
| `origin`         | String | The 3-letter IATA code for the origin airport.                                           | **Yes**  |
| `destination`    | String | The 3-letter IATA code for the destination airport.                                      | **Yes**  |
| `departure_date` | String | The departure date.                                                                      | **Yes**  |
| `return_date`    | String | The return date. Required for round trips. If omitted, the search is treated as one-way. | No       |

#### 1.2. Date Formats

The system accepts dates as strings in the following formats:

- `YYYY-MM-DD` (e.g., `"2025-12-03"`)
- `YYYY/MM/DD` (e.g., `"2025/12/03"`)
- `MM/DD/YYYY` (e.g., `"12/03/2025"`)

#### 1.3. Examples

**One-Way Trip:**

```json
{
  "origin": "YVR",
  "destination": "NRT",
  "departure_date": "2026-05-11"
}
```

**Round Trip:**

```json
{
  "origin": "YVR",
  "destination": "NRT",
  "departure_date": "2026-05-11",
  "return_date": "2026-05-18"
}
```

---

### 2. Specifying Passengers and Cabin Class

You can specify the number and type of passengers, as well as the desired cabin class.

#### 2.1. Passenger and Cabin Fields

| Field                  | Type   | Description                                                                                                                          | Default        |
| :--------------------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------- | :------------- |
| `passengers`           | Object | An object detailing the number of travelers.                                                                                         | `{"adult": 1}` |
| `seat` / `cabin_class` | String | The desired cabin class. You can use either field name. Accepted values are case-insensitive (e.g., "Economy", "Business", "First"). | `"economy"`    |

The `passengers` object has the following structure:

| Field    | Type    | Description                  | Default |
| :------- | :------ | :--------------------------- | :------ |
| `adult`  | Integer | Number of adult passengers.  | `1`     |
| `child`  | Integer | Number of child passengers.  | `0`     |
| `infant` | Integer | Number of infant passengers. | `0`     |

#### 2.2. Example

**Search for 2 adults and 1 child in Business Class:**

```json
{
  "origin": "YVR",
  "destination": "NRT",
  "departure_date": "2026-05-11",
  "return_date": "2026-05-18",
  "passengers": {
    "adult": 2,
    "child": 1
  },
  "seat": "business"
}
```

---

### 3. Advanced Search: Fixed Flights

For complex itineraries where specific flights or layovers are required, you can use the fixed_flights field. This is useful for forcing a particular route or building multi-segment journeys.

When `fixed_flights` is used, the `origin` and `destination` at the top level still define the overall journey's start and end points.

#### 3.1. `fixed_flights` Structure

| Field           | Type   | Description                                                                                  | Required |
| :-------------- | :----- | :------------------------------------------------------------------------------------------- | :------- |
| `fixed_flights` | Object | An object containing lists of specific flight segments for the outbound and return journeys. | No       |

The `fixed_flights` object contains `outbound` and optional `return` legs, which are arrays of flight segments.

| Field      | Type  | Description                                                                                      |
| :--------- | :---- | :----------------------------------------------------------------------------------------------- |
| `outbound` | Array | A list of one or more flight segments for the outbound journey.                                  |
| `return`   | Array | A list of one or more flight segments for the return journey. Cannot be used without `outbound`. |

Each **segment** object in the array has the following structure:

| Field                 | Type   | Description                                        |
| :-------------------- | :----- | :------------------------------------------------- |
| `origin_airport`      | String | The origin airport for this specific segment.      |
| `destination_airport` | String | The destination airport for this specific segment. |
| `date`                | String | The departure date for this segment.               |
| `airline_code`        | String | The two-letter IATA code for the airline.          |
| `flight_number`       | String | The flight number.                                 |

#### 3.2. Example

**Round-trip from YVR to NRT with a specific layover in HKG on the outbound journey:**

In this example, the user wants to fly from YVR to NRT via HKG on the way out, and the return journey from NRT to YVR can be any flight.

```json
{
  "origin": "YVR",
  "destination": "NRT",
  "departure_date": "2026-05-11",
  "return_date": "2026-05-18",
  "fixed_flights": {
    "outbound": [
      {
        "origin_airport": "YVR",
        "destination_airport": "HKG",
        "date": "2026-05-11",
        "airline_code": "HX",
        "flight_number": "81"
      },
      {
        "origin_airport": "HKG",
        "destination_airport": "NRT",
        "date": "2026-05-11",
        "airline_code": "HX",
        "flight_number": "604"
      }
    ]
  },
  "passengers": { "adult": 2, "child": 1 },
  "seat": "economy"
}
```

---

### 4. Configuration Options

These additional fields control the scraper's behavior and output filtering.

| Field                         | Type    | Description                                                                                     | Default  |
| :---------------------------- | :------ | :---------------------------------------------------------------------------------------------- | :------- |
| `max_results`                 | Integer | The maximum number of flight combinations to return. Set to `0` for no limit.                   | `0`      |
| `max_outbound_flight_limit`   | Integer | The maximum number of outbound flights to consider during search. Useful for reducing search space.| `3`      |
| `max_return_flight_limit`     | Integer | The maximum number of return flights to consider for each outbound flight option.               | `3`      |
| `max_crawler_runtime_secs`   | Integer | The maximum time allowed for a single browser fetch operation.                                  | `60`     |
| `only_direct_airline_booking` | Boolean | If `true`, the results will only include booking options directly from the airline, excluding OTAs. | `false`  |
| `debug`                       | Boolean | If `true`, runs the browser in headful mode for debugging purposes.                             | `false`  |

---

### 5. Error Handling

The system will raise an error if the input is invalid. Common errors include:

- Missing `origin` or `destination` fields.
- Providing `return` segments in `fixed_flights` without `outbound` segments.
- Using an unrecognized date format.

---

## Actor Output

The actor stores its results in the default dataset. The output is a **flattened JSON array**, where each object represents a unique combination of a flight itinerary and a booking option. This means if a single flight has 3 different booking agents (e.g., Airline, Expedia, CheapOair), it will appear as 3 separate entries in the dataset, each with the same flight details but different `price`, `agent`, and `bookingUrl`.

### Sample Output

```json
[
  {
    "segments": [
      {
        "origin": "YVR",
        "destination": "SFO",
        "departure_time": "7:00 AM",
        "arrival_time": "9:38 AM",
        "airline": "United",
        "flight_code": "UA 2322",
        "seat_class": "Economy",
        "aircraft": "Airbus A320",
        "duration": "2 hr 38 min"
      }
    ],
    "total_duration": "2 hr 38 min",
    "layovers": [ "Nonstop" ],
    "amenities": {},
    "bookingUrl": "https://www.google.com/travel/flights/booking?tfs=...",
    "price": "CA$353",
    "agent": "United",
    "is_direct_airline": true
  },
  {
    "segments": [
      {
        "origin": "YVR",
        "destination": "SFO",
        "departure_time": "7:00 AM",
        "arrival_time": "9:38 AM",
        "airline": "United",
        "flight_code": "UA 2322",
        "seat_class": "Economy",
        "aircraft": "Airbus A320",
        "duration": "2 hr 38 min"
      }
    ],
    "total_duration": "2 hr 38 min",
    "layovers": [ "Nonstop" ],
    "amenities": {},
    "bookingUrl": "https://www.google.com/travel/flights/booking?tfs=...",
    "price": "CA$332",
    "agent": "Air Canada",
    "is_direct_airline": true
  }
]
```

---

## Usage

### Local Development

To run the actor locally, you need to have Node.js and Python installed.

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Provide your input in the `storage/key_value_stores/default/INPUT.json` file.
4.  Run the actor:
    ```bash
    npm start
    ```

### Apify Platform

When running on the Apify platform, you can provide the input via the UI. The actor will run automatically and save the results in the default dataset.

---

## License

This project is licensed under the Apache License 2.0. See the `LICENSE.txt` file for details.

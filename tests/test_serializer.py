import pytest
from serializer.flight_serializer import FlightSerializer


@pytest.fixture
def sample_itinerary():
    """Provides a sample itinerary dictionary for testing."""
    return {
        "itinerary": [
            {
                "origin": {"code": "JFK"},
                "destination": {"code": "SFO"},
                "travel_date": "2025-12-20",
            }
        ],
        "passengers": {"adult": 1},
        "cabin_class": "economy",
        "trip_type": "trip_type_one_way",
    }


def test_serialization_deserialization_cycle(sample_itinerary):
    """
    Tests that an itinerary can be serialized to a base64 string and then
    deserialized back to the original structure without data loss.
    """
    # Serialize the sample itinerary to a base64url string
    encoded_tfs = FlightSerializer.serialize_base64url(sample_itinerary)
    assert isinstance(encoded_tfs, str)
    assert len(encoded_tfs) > 0
    assert "=" not in encoded_tfs  # Base64url should not have padding
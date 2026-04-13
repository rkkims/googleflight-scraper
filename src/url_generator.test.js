import { describe, it, expect } from "@jest/globals";
import { generatGoogleFlightsURL } from "./url_generator.js";

describe("generatGoogleFlightsURL", () => {
  const tfs = "abc123base64payload";

  it("throws when tfsBase64Url is missing", () => {
    expect(() => generatGoogleFlightsURL(null)).toThrow("Missing tfs base64 payload");
    expect(() => generatGoogleFlightsURL("")).toThrow("Missing tfs base64 payload");
    expect(() => generatGoogleFlightsURL(undefined)).toThrow("Missing tfs base64 payload");
  });

  it("throws when type is invalid", () => {
    expect(() => generatGoogleFlightsURL(tfs, { type: "invalid" })).toThrow('Invalid fetch type');
  });

  it("defaults to search type", () => {
    const url = generatGoogleFlightsURL(tfs);
    expect(url.pathname).toBe("/travel/flights/search");
  });

  it("uses booking type when specified", () => {
    const url = generatGoogleFlightsURL(tfs, { type: "booking" });
    expect(url.pathname).toBe("/travel/flights/booking");
  });

  it("sets tfs query parameter", () => {
    const url = generatGoogleFlightsURL(tfs);
    expect(url.searchParams.get("tfs")).toBe(tfs);
  });

  it("defaults lang to en, region to CA, currency to CAD", () => {
    const url = generatGoogleFlightsURL(tfs);
    expect(url.searchParams.get("hl")).toBe("en");
    expect(url.searchParams.get("gl")).toBe("CA");
    expect(url.searchParams.get("curr")).toBe("CAD");
  });

  it("uses provided lang, region, and currency", () => {
    const url = generatGoogleFlightsURL(tfs, { lang: "es", region: "US", currency: "USD" });
    expect(url.searchParams.get("hl")).toBe("es");
    expect(url.searchParams.get("gl")).toBe("US");
    expect(url.searchParams.get("curr")).toBe("USD");
  });

  it("returns a URL object pointing to google.com", () => {
    const url = generatGoogleFlightsURL(tfs);
    expect(url.hostname).toBe("www.google.com");
  });
});

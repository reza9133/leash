import { describe, expect, it } from "vitest";
import { formatDuration, isAddress, parseGen, plural, weiToGenText } from "../../src/lib/format";

describe("format", () => {
  it("parses GEN amounts exactly", () => {
    expect(parseGen("1")).toBe(10n ** 18n);
    expect(parseGen("0.001")).toBe(10n ** 15n);
    expect(parseGen("abc")).toBeNull();
  });
  it("prints wei without losing digits", () => {
    expect(weiToGenText(10n ** 18n + 1n)).toBe("1.000000000000000001");
  });
  it("recognises addresses", () => {
    expect(isAddress("0x13Ad9bC5C0a1fcC19f5C410b6685EB6029893CB5")).toBe(true);
    expect(isAddress("0x123")).toBe(false);
  });
  it("formats durations and plurals", () => {
    expect(formatDuration(3600)).toMatch(/1\s*h/i);
    expect(plural(1, "seat")).toBe("1 seat");
    expect(plural(2, "seat")).toBe("2 seats");
  });
});

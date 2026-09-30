import { describe, expect, it } from "vitest";
import { parseStartLink } from "./startLink";

const valid = { name: "Jordan Lee", email: "jordan@example.com", austin: "yes", solar: "no" };

describe("parseStartLink", () => {
  it("reads all four values", () => {
    expect(parseStartLink(valid)).toEqual({
      name: "Jordan Lee",
      firstName: "Jordan",
      email: "jordan@example.com",
      inAustin: true,
      hasSolar: false,
      address: null,
      extra: "",
    });
  });

  it("reads an optional address and does not carry it through", () => {
    const link = parseStartLink({ ...valid, address: "  1100 Congress Ave, Austin, TX 78701 ", demo: "good" });
    expect(link?.address).toBe("1100 Congress Ave, Austin, TX 78701");
    expect(link?.extra).toBe("demo=good");
  });

  it("ignores an address that is empty, too short, too long or repeated", () => {
    expect(parseStartLink({ ...valid, address: "   " })?.address).toBeNull();
    expect(parseStartLink({ ...valid, address: "1 A" })?.address).toBeNull();
    expect(parseStartLink({ ...valid, address: "x".repeat(301) })?.address).toBeNull();
    expect(parseStartLink({ ...valid, address: ["1100 Congress Ave", "2"] })?.address).toBeNull();
    expect(parseStartLink({ ...valid, address: "x".repeat(301) })).not.toBeNull();
  });

  it("carries other parameters through", () => {
    expect(parseStartLink({ ...valid, demo: "good", z: ["1", "2"] })?.extra).toBe("demo=good&z=1&z=2");
  });

  it.each(["name", "email", "austin", "solar"])("is null when %s is missing", (key) => {
    expect(parseStartLink({ ...valid, [key]: undefined })).toBeNull();
  });

  it("is null when a value is invalid", () => {
    expect(parseStartLink({ ...valid, email: "not-an-email" })).toBeNull();
    expect(parseStartLink({ ...valid, austin: "maybe" })).toBeNull();
    expect(parseStartLink({ ...valid, solar: "true" })).toBeNull();
    expect(parseStartLink({ ...valid, name: "   " })).toBeNull();
    expect(parseStartLink({ ...valid, name: ["a", "b"] })).toBeNull();
  });
});

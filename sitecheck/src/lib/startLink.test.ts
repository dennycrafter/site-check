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
      extra: "",
    });
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

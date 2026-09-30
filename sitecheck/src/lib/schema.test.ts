import { describe, expect, it } from "vitest";
import { PHOTO_ANALYSIS_SCHEMA, parseAnalysisText } from "./schema";
import { GOOD_ANALYSIS } from "./testing";

describe("parseAnalysisText", () => {
  it("reads meter_in_locked_cabinet", () => {
    const text = JSON.stringify({ ...GOOD_ANALYSIS, meter_in_locked_cabinet: true });
    expect(parseAnalysisText(text).meter_in_locked_cabinet).toBe(true);
  });

  it("reads an older analysis without meter_in_locked_cabinet as false", () => {
    const old = Object.fromEntries(Object.entries(GOOD_ANALYSIS).filter(([k]) => k !== "meter_in_locked_cabinet"));
    expect(parseAnalysisText(JSON.stringify(old)).meter_in_locked_cabinet).toBe(false);
  });

  it("asks the model for meter_in_locked_cabinet", () => {
    expect(PHOTO_ANALYSIS_SCHEMA.required).toContain("meter_in_locked_cabinet");
    expect(PHOTO_ANALYSIS_SCHEMA.properties.meter_in_locked_cabinet).toEqual({ type: "boolean" });
  });
});

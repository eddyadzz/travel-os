import { describe, expect, it } from "vitest";
import { isBlockActive } from "@/components/promotional-block";

const today = new Date().toISOString().slice(0, 10);
const future = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
const past = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);

describe("isBlockActive", () => {
  it("is false when the block is missing or disabled", () => {
    expect(isBlockActive(undefined)).toBe(false);
    expect(isBlockActive({ enabled: false, title: "Hi" })).toBe(false);
    expect(isBlockActive({ enabled: true, title: "" })).toBe(false);
  });

  it("is true for an enabled block with a title", () => {
    expect(isBlockActive({ enabled: true, title: "Save 20%" })).toBe(true);
  });

  it("respects the date window", () => {
    expect(isBlockActive({ enabled: true, title: "x", startDate: future })).toBe(false);
    expect(isBlockActive({ enabled: true, title: "x", endDate: past })).toBe(false);
    expect(isBlockActive({ enabled: true, title: "x", startDate: past, endDate: future })).toBe(
      true,
    );
  });
});

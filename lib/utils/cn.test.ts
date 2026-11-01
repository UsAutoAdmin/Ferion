import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins classes and drops falsy values", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("resolves conflicting Tailwind utilities with last-wins", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
    expect(cn("text-fg", "text-accent")).toBe("text-accent");
  });
});

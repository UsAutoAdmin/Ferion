import { describe, expect, it } from "vitest";
import { canonicalizeTypeKey } from "./part-synonyms";
import { PART_TYPES, PART_TYPE_KEYS, partTypeOf } from "./part-types";

describe("PART_TYPES taxonomy", () => {
  it("covers the key resellable categories without going obscure", () => {
    for (const k of [
      "RADIO", "DASH BEZEL", "INSTRUMENT CLUSTER BEZEL", "OVERHEAD CONSOLE", "CENTER CONSOLE",
      "ANTI LOCK BRAKE PUMP", "STEERING WHEEL", "AIR BAG", "SHIFTER TRIM", "HEADLIGHT", "TAIL LIGHT",
    ]) expect(PART_TYPE_KEYS).toContain(k);
    for (const k of ["PISTON", "CONNECTING ROD", "CRANKSHAFT", "ENGINE", "TRANSMISSION"]) {
      expect(PART_TYPE_KEYS).not.toContain(k);
    }
    expect(PART_TYPES.length).toBeGreaterThanOrEqual(50);
    expect(PART_TYPES.length).toBeLessThanOrEqual(80);
    // Always-listed types stay near the requested ~50.
    expect(PART_TYPES.filter((p) => !p.conditional).length).toBeLessThanOrEqual(60);
  });

  it("uses canonical keys so catalog rows fold onto them", () => {
    for (const p of PART_TYPES) {
      expect(canonicalizeTypeKey(p.key), `${p.key} is not canonical`).toBe(p.key);
    }
  });

  it("has unique keys", () => {
    expect(new Set(PART_TYPE_KEYS).size).toBe(PART_TYPE_KEYS.length);
  });
});

describe("partTypeOf", () => {
  it("maps exact and alias spellings", () => {
    expect(partTypeOf("Radio")).toBe("RADIO");
    expect(partTypeOf("ALTERNATOR")).toBe("GENERATOR");
    expect(partTypeOf("ABS Pump")).toBe("ANTI LOCK BRAKE PUMP");
    expect(partTypeOf("Airbag")).toBe("AIR BAG");
    expect(partTypeOf("Radio Bezel")).toBe("DASH BEZEL");
    expect(partTypeOf("Key Fob")).toBe("KEY REMOTE FOB");
    expect(partTypeOf("Floor Console")).toBe("CENTER CONSOLE");
    expect(partTypeOf("Headlamp")).toBe("HEADLIGHT");
  });

  it("tolerates body-style and trim residue in catalog names", () => {
    expect(partTypeOf("Pickup Radio Bezel")).toBe("DASH BEZEL");
    expect(partTypeOf("Van Overhead Console")).toBe("OVERHEAD CONSOLE");
    expect(partTypeOf("Raptor Tail Light")).toBe("TAIL LIGHT");
    expect(partTypeOf("Woodgrain Shifter Bezel")).toBe("SHIFTER TRIM");
  });

  it("rejects pieces and accessories of a type", () => {
    expect(partTypeOf("Headlight Bulb")).toBeNull();
    expect(partTypeOf("Tail Light Lens")).toBeNull();
    expect(partTypeOf("Radio Knob")).toBeNull();
    expect(partTypeOf("Door Mirror Glass")).toBeNull();
    expect(partTypeOf("Steering Wheel Cover")).toBeNull();
    expect(partTypeOf("Headlight Bracket")).toBeNull();
  });

  it("keeps types whose own name contains a piece word", () => {
    expect(partTypeOf("Sunroof Motor")).toBe("SUN ROOF MOTOR");
    expect(partTypeOf("Cargo Cover")).toBe("CARGO COVER");
    expect(partTypeOf("Tonneau Cover")).toBe("TONNEAU COVER");
    expect(partTypeOf("Tailgate Handle")).toBe("TAILGATE LATCH");
  });

  it("maps real catalog spellings", () => {
    expect(partTypeOf("ANTI-LOCK BRAKE COMPUTER")).toBe("ANTI LOCK BRAKE PUMP");
    expect(partTypeOf("COMPUTER BOX ENGINE")).toBe("ENGINE CONTROL MODULE");
    expect(partTypeOf("HEADLIGHT HOUSING")).toBe("HEADLIGHT");
    expect(partTypeOf("SPEEDOMETER")).toBe("INSTRUMENT CLUSTER");
    expect(partTypeOf("GEAR SHIFT INDICATOR")).toBe("SHIFTER TRIM");
    expect(partTypeOf("A/C COMPRESSOR")).toBe("AC COMPRESSOR");
    expect(partTypeOf("INTERIOR LIGHT")).toBe("DOME LIGHT");
    expect(partTypeOf("3500 VAN THIRD BRAKE LIGHT")).toBe("THIRD BRAKE LIGHT");
    expect(partTypeOf("DOOR ARMREST")).toBeNull();
    expect(partTypeOf("PICKUP DOOR ARMREST")).toBeNull();
  });

  it("rejects out-of-scope and empty input", () => {
    expect(partTypeOf("Piston")).toBeNull();
    expect(partTypeOf("Connecting Rod")).toBeNull();
    expect(partTypeOf("Engine")).toBeNull();
    expect(partTypeOf("")).toBeNull();
  });
});

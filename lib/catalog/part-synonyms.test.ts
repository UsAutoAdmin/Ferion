import { describe, expect, it } from "vitest";
import { canonicalizeTypeKey, synonymTargets } from "./part-synonyms";

describe("canonicalizeTypeKey", () => {
  it("collapses the S2000 screenshot dupes to one cluster key", () => {
    expect(canonicalizeTypeKey("GAUGE")).toBe("INSTRUMENT CLUSTER");
    expect(canonicalizeTypeKey("GAUGES")).toBe("INSTRUMENT CLUSTER");
    expect(canonicalizeTypeKey("SPEEDOMETER")).toBe("INSTRUMENT CLUSTER");
    expect(canonicalizeTypeKey("SPEEDOMETER CLUSTER")).toBe("INSTRUMENT CLUSTER");
    expect(canonicalizeTypeKey("GAUGE CLUSTER")).toBe("INSTRUMENT CLUSTER");
    expect(canonicalizeTypeKey("INSTRUMENT CLUSTER")).toBe("INSTRUMENT CLUSTER");
  });

  it("keeps component listings distinct from their assemblies", () => {
    expect(canonicalizeTypeKey("INSTRUMENT CLUSTER BEZEL")).toBe("INSTRUMENT CLUSTER BEZEL");
    expect(canonicalizeTypeKey("HEADLIGHT BULB")).toBe("HEADLIGHT BULB");
    expect(canonicalizeTypeKey("TAIL LIGHT LENS")).toBe("TAIL LIGHT LENS");
    expect(canonicalizeTypeKey("GAS CAP")).toBe("GAS CAP");
  });

  it("normalizes compound-word and lamp/light spelling variants", () => {
    expect(canonicalizeTypeKey("SUNVISOR")).toBe("SUN VISOR");
    expect(canonicalizeTypeKey("Sun Visor")).toBe("SUN VISOR");
    expect(canonicalizeTypeKey("VISOR")).toBe("SUN VISOR");
    expect(canonicalizeTypeKey("HEADLAMP")).toBe("HEADLIGHT");
    expect(canonicalizeTypeKey("HEAD LIGHT")).toBe("HEADLIGHT");
    expect(canonicalizeTypeKey("HEAD LIGHT SWITCH")).toBe("HEADLIGHT SWITCH");
    expect(canonicalizeTypeKey("TAILLIGHT")).toBe("TAIL LIGHT");
    expect(canonicalizeTypeKey("TAIL LAMP")).toBe("TAIL LIGHT");
    expect(canonicalizeTypeKey("FOG LAMP")).toBe("FOG LIGHT");
    expect(canonicalizeTypeKey("CLOCK SPRING")).toBe("CLOCKSPRING");
    expect(canonicalizeTypeKey("HUB CAP")).toBe("HUBCAP");
  });

  it("maps known physical duplicates to one canonical key", () => {
    expect(canonicalizeTypeKey("GAS PEDAL")).toBe("ACCELERATOR PEDAL");
    expect(canonicalizeTypeKey("FUEL CAP")).toBe("GAS CAP");
    expect(canonicalizeTypeKey("WHEEL COVER")).toBe("HUBCAP");
    expect(canonicalizeTypeKey("COMPUTER BOX ENGINE")).toBe("ENGINE CONTROL MODULE");
    expect(canonicalizeTypeKey("ECU")).toBe("ENGINE CONTROL MODULE");
    expect(canonicalizeTypeKey("TCM")).toBe("TRANSMISSION COMPUTER");
    expect(canonicalizeTypeKey("ALTERNATOR")).toBe("GENERATOR");
    expect(canonicalizeTypeKey("HVAC CONTROL")).toBe("CLIMATE CONTROL");
    expect(canonicalizeTypeKey("PARKING BRAKE")).toBe("EMERGENCY BRAKE");
    expect(canonicalizeTypeKey("SIDE VIEW MIRROR")).toBe("DOOR MIRROR");
    expect(canonicalizeTypeKey("REARVIEW MIRROR")).toBe("REAR VIEW MIRROR");
    expect(canonicalizeTypeKey("STEERING GEAR BOX")).toBe("STEERING RACK");
    expect(canonicalizeTypeKey("ABS PUMP")).toBe("ANTI LOCK BRAKE PUMP");
    expect(canonicalizeTypeKey("Anti-Lock Brake Pump")).toBe("ANTI LOCK BRAKE PUMP");
    expect(canonicalizeTypeKey("SPARE TIRE HOIST")).toBe("SPARE TIRE CARRIER");
    expect(canonicalizeTypeKey("KEY FOB")).toBe("KEY REMOTE FOB");
    expect(canonicalizeTypeKey("POWER BRAKE BOOSTER")).toBe("BRAKE BOOSTER");
  });

  it("passes unknown keys through normalized, never empty", () => {
    expect(canonicalizeTypeKey("SUPERCHARGER")).toBe("SUPERCHARGER");
    expect(canonicalizeTypeKey("Engine Cradle")).toBe("ENGINE CRADLE");
    expect(canonicalizeTypeKey("Q5")).toBe("Q5");
  });

  it("drops filler tokens like ASSEMBLY", () => {
    expect(canonicalizeTypeKey("AXLE ASSEMBLY")).toBe("AXLE");
    expect(canonicalizeTypeKey("HEADLIGHT ASSY")).toBe("HEADLIGHT");
  });

  it("is idempotent: every synonym target is a fixed point", () => {
    for (const target of synonymTargets()) {
      expect(canonicalizeTypeKey(target), `synonym target "${target}" is not a fixed point`).toBe(target);
    }
  });
});

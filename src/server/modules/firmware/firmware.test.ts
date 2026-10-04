import { describe, expect, it } from "vitest";
import { canStartUpdate, compareVersions, isUpdateAvailable } from "./firmware";

const release = { version: "V1.3.0", status: "published" as const, minBatteryPercent: 30 };
const device = {
  online: true,
  batteryPercent: 80,
  currentVersion: "V1.2.0",
  state: "idle" as const,
};

describe("compareVersions", () => {
  it("orders versions and ignores the V prefix and missing parts", () => {
    expect(compareVersions("V1.3.0", "V1.2.0")).toBeGreaterThan(0);
    expect(compareVersions("V1.2.0", "V1.3.0")).toBeLessThan(0);
    expect(compareVersions("1.2", "V1.2.0")).toBe(0);
    expect(compareVersions("V1.10.0", "V1.9.0")).toBeGreaterThan(0);
  });

  it("returns null for invalid versions", () => {
    expect(compareVersions("latest", "V1.2.0")).toBeNull();
  });
});

describe("isUpdateAvailable", () => {
  it("is true only for a strictly newer release", () => {
    expect(isUpdateAvailable("V1.2.0", "V1.3.0")).toBe(true);
    expect(isUpdateAvailable("V1.3.0", "V1.3.0")).toBe(false);
    expect(isUpdateAvailable("V1.3.0", "V1.2.0")).toBe(false);
  });
});

describe("canStartUpdate", () => {
  it("is blocked in V1 because OTA is not enabled", () => {
    const result = canStartUpdate({ device, release });
    expect(result.ok).toBe(false);
  });

  it("allows a healthy device when enabled", () => {
    expect(canStartUpdate({ device, release }, { otaEnabled: true }).ok).toBe(true);
  });

  it("blocks offline, low battery, busy, withdrawn and not-newer cases", () => {
    const on = { otaEnabled: true };
    expect(canStartUpdate({ device: { ...device, online: false }, release }, on).ok).toBe(false);
    expect(canStartUpdate({ device: { ...device, batteryPercent: 20 }, release }, on).ok).toBe(false);
    expect(canStartUpdate({ device: { ...device, state: "installing" }, release }, on).ok).toBe(false);
    expect(canStartUpdate({ device, release: { ...release, status: "withdrawn" } }, on).ok).toBe(false);
    expect(canStartUpdate({ device: { ...device, currentVersion: "V1.3.0" }, release }, on).ok).toBe(false);
  });
});
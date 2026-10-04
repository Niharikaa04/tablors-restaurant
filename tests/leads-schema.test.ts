import { describe, expect, it } from "vitest";
import { demoRequestSchema } from "@/server/modules/leads/schema";

const validPayload = {
  restaurantName: "The Green Fork",
  ownerName: "A. Owner",
  phone: "+91 98765 43210",
  email: "owner@example.com",
  city: "Hyderabad",
  tableCount: "12",
  restaurantType: "Restaurant",
  message: "",
  consent: true,
  companyWebsite: "",
};

describe("demoRequestSchema", () => {
  it("accepts a fully valid submission", () => {
    const result = demoRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects a missing restaurant name", () => {
    const result = demoRequestSchema.safeParse({ ...validPayload, restaurantName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = demoRequestSchema.safeParse({ ...validPayload, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a table count below 1", () => {
    const result = demoRequestSchema.safeParse({ ...validPayload, tableCount: "0" });
    expect(result.success).toBe(false);
  });

  it("requires consent to be explicitly true", () => {
    const result = demoRequestSchema.safeParse({ ...validPayload, consent: false });
    expect(result.success).toBe(false);
  });

  it("rejects submissions where the honeypot field is filled in", () => {
    const result = demoRequestSchema.safeParse({
      ...validPayload,
      companyWebsite: "https://spambot.example",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown restaurant type", () => {
    const result = demoRequestSchema.safeParse({ ...validPayload, restaurantType: "Nightclub" });
    expect(result.success).toBe(false);
  });
});

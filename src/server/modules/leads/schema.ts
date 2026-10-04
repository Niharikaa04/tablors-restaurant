import { z } from "zod";

export const restaurantTypes = [
  "Restaurant",
  "Hotel",
  "Cafe",
  "Theatre",
  "Lounge",
  "Banquet hall",
  "Other",
] as const;

export const demoRequestSchema = z.object({
  restaurantName: z.string().trim().min(2, "Enter your restaurant's name").max(120),
  ownerName: z.string().trim().min(2, "Enter the owner's name").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\-\s]{7,15}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email address"),
  city: z.string().trim().min(2, "Enter a city").max(80),
  tableCount: z.coerce
    .number()
    .int("Enter a whole number")
    .min(1, "Must be at least 1")
    .max(1000, "Enter a realistic table count"),
  restaurantType: z.enum(restaurantTypes),
  message: z.string().trim().max(1000).optional().default(""),
  consent: z.literal(true, {
    error: "Please confirm you agree to be contacted",
  }),
  // Honeypot field — real users never fill this in. Bots that fill
  // every field on a form usually do.
  companyWebsite: z.string().max(0, "").optional().default(""),
});

export type DemoRequestInput = z.infer<typeof demoRequestSchema>;

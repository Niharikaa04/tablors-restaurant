import type { Metadata } from "next";

import { Hero } from "@/components/marketing/hero";
import { ProductStory } from "@/components/marketing/product-story";
import { ConnectedSystem } from "@/components/marketing/connected-system";
import { OpenDevice } from "@/components/marketing/open-device";
import { Specifications } from "@/components/marketing/specifications";
import { Features } from "@/components/marketing/features";
import { BusinessTypes } from "@/components/marketing/business-types";
import { Pricing } from "@/components/marketing/pricing";
import { DemoSection } from "@/components/marketing/demo-section";

// `absolute` keeps this exact title, whatever title template the layout sets.
// A page-level `openGraph` replaces the layout's `openGraph` completely, so
// `siteName` and `type` are repeated here on purpose.
export const metadata: Metadata = {
  title: {
    absolute: "Table Ordering System for Restaurants, Hotels & Hospitals | Tablor's",
  },
  description:
    "A countertop ordering device for every table. Guests choose their items, and the order goes straight to the kitchen. Book a free demo.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Table Ordering System for Restaurants, Hotels & Hospitals | Tablor's",
    description:
      "A small ordering device on every table. Orders go straight to the kitchen, and you can see every table and bill in one place.",
    siteName: "Tablor's",
    type: "website",
  },
};

export default function MarketingHome() {
  return (
    <>
      <Hero />

      <BusinessTypes />

      <OpenDevice />

      <ProductStory />

      <ConnectedSystem />

      <Features />

      <Specifications />

      <Pricing />

      {/* Actual demo request form */}
      <DemoSection />
    </>
  );
}
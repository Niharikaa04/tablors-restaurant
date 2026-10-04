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

export const metadata: Metadata = {
  title: "Tablor's — Smart Table Ordering for Restaurants",
  description:
    "Tablor's puts a smart ordering device on every table, sends orders straight to the kitchen, and keeps billing accurate. Book a free demo.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Tablor's — Smart Table Ordering for Restaurants",
    description:
      "A book-shaped table ordering device, a kitchen display system, and an owner dashboard — in one connected platform.",
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
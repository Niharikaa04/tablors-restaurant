import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// NOTE: Intentionally not using next/font/google here — build/CI
// environments for this project may not have outbound access to
// fonts.googleapis.com. Using a system font stack (defined as
// --font-sans in globals.css) keeps builds reliable everywhere.
// Swap in next/font/local with a self-hosted typeface if a specific
// brand font is chosen later.

// Site-wide defaults. Any page can override these with its own `metadata`.
// TODO (needs the real production domain): add
//   metadataBase: new URL("https://<your-production-domain>"),
// so relative canonical and social-image URLs resolve correctly.
export const metadata: Metadata = {
  title: {
    default: "Tablor's — Table Ordering System for Restaurants, Hotels & Hospitals",
    template: "%s | Tablor's",
  },
  description:
    "Tablor's is a table ordering system. Guests choose their items on a countertop device, and the order goes straight to the kitchen.",
  applicationName: "Tablor's",
  openGraph: {
    siteName: "Tablor's",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
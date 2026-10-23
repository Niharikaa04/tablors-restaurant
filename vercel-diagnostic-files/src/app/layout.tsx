import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// NOTE: Intentionally not using next/font/google here — build/CI
// environments for this project may not have outbound access to
// fonts.googleapis.com. Using a system font stack (defined as
// --font-sans in globals.css) keeps builds reliable everywhere.
// Swap in next/font/local with a self-hosted typeface if a specific
// brand font is chosen later.

export const metadata: Metadata = {
  title: "Tablor's — Table Ordering System",
  description:
    "Smart table ordering, kitchen management, and live billing for modern restaurants.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

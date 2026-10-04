"use client";

import { useEffect } from "react";

/**
 * Adds/removes a class on <html> for the lifetime of the marketing
 * layout only. This keeps scroll-snap CSS (see globals.css,
 * `html.marketing-scroll`) completely out of the owner/kitchen/admin
 * dashboards and the auth routes, which live under different layouts
 * and never mount this component.
 */
export function MarketingScrollScope() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("marketing-scroll");
    return () => {
      root.classList.remove("marketing-scroll");
    };
  }, []);

  return null;
}

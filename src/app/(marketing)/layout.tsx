import type { ReactNode } from "react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { ScrollProgress } from "@/components/marketing/scroll-progress";
import { MarketingScrollScope } from "@/components/marketing/motion/marketing-scroll-scope";
import { TablorOpening } from "@/components/marketing/tablor-opening";

// Runs before first paint. Hides the opening gate for returning visitors
// (already opened/skipped), deep links (#hash) and every route but "/",
// so nobody sees a flash of the gate. Must stay in sync with the checks
// in tablor-opening.tsx.
const GATE_GUARD = `(function(){try{var g=document.querySelector("[data-tablor-gate]");if(!g)return;if(location.pathname!=="/"||location.hash){g.hidden=true;g.style.display="none"}}catch(e){}})();`;

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tablor-marketing relative flex min-h-screen flex-col">
      <TablorOpening />
      <script dangerouslySetInnerHTML={{ __html: GATE_GUARD }} />
      {/* Without JS the gate can't be opened, so never show it. */}
      <noscript>
        <style>{`[data-tablor-gate]{display:none!important}`}</style>
      </noscript>

      <div aria-hidden="true" className="mkt-grain" />
      <MarketingScrollScope />
      <ScrollProgress />
      <Navbar />
      {/* Reserves the space the fixed header would otherwise cover.
          Kept in sync with the `scrollMarginTop: "4.25rem"` used
          throughout the page's section anchors. */}
      <div aria-hidden="true" className="h-[4.25rem]" />
      <main className="relative z-[2] flex-1">{children}</main>
      <Footer />
    </div>
  );
}
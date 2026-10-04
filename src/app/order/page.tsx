import type { Metadata } from "next";
import { getTables } from "@/server/modules/demo-store/store";
import { TablePicker } from "@/components/order/table-picker";

export const metadata: Metadata = {
  title: "Choose Your Table — Tablor's",
};

export default function OrderTableSelectionPage() {
  const tables = getTables();

  return (
    <div className="tablor-customer min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[var(--tablor-border)] bg-[var(--tablor-bg)]/95 px-4 py-4 backdrop-blur sm:px-6">
        <p className="text-lg font-semibold tracking-wide text-[var(--tablor-text-primary)]">
          Tablor&apos;s
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold text-[var(--tablor-text-primary)] sm:text-3xl">
          Choose Your Table
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--tablor-text-secondary)]">
          Select an available table to view today&apos;s menu and start your
          order. Occupied and reserved tables can&apos;t be selected right
          now.
        </p>

        <div className="mt-8">
          <TablePicker tables={tables} />
        </div>
      </main>
    </div>
  );
}
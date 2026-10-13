import type { Metadata } from "next";
import Link from "next/link";

import SliceHarness from "./SliceHarness";

export const metadata: Metadata = {
  title: "Vertical slice · Sidequest",
  robots: { index: false },
};

export default function SlicePage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vertical slice</h1>
          <p className="text-muted-foreground text-sm">
            Anaheim → Denver with Matt and Alex: real Qloo pipeline, simulated drive, Side Quests.
          </p>
        </div>
        <Link href="/" className="text-sm underline underline-offset-4">
          Home
        </Link>
      </header>
      <SliceHarness />
    </main>
  );
}

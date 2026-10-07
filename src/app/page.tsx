import Link from "next/link";
import { Compass, MapPinned, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-24 text-center">
      <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium tracking-wide uppercase">
        <Compass className="size-4" aria-hidden />
        Sidequest
      </div>

      <div className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          The road trip built around your taste.
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">
          Google Maps tells you what&apos;s along the way. Sidequest finds what&apos;s along the way
          that <em>your crew</em> would actually love.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" disabled>
          <Sparkles aria-hidden />
          Try the demo trip (coming soon)
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/dev/route" />}>
          <MapPinned aria-hidden />
          Route smoke test
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Built for the Qloo Agentic Hackathon · v0.1.0 foundations
      </p>
    </main>
  );
}

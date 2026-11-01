import Link from "next/link";
import { primaryNavItems } from "@/components/nav-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Stat } from "@/components/ui/stat";

export default function HomePage() {
  return (
    <>
      <section className="py-20 sm:py-28">
        <Container className="flex flex-col items-center text-center">
          <Badge tone="accent" className="mb-8">
            Enterprise
          </Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-medium tracking-tight text-fg sm:text-5xl md:text-6xl md:leading-[1.05]">
            Value every lot <span className="text-accent">before you bid.</span>
          </h1>
          <p className="mt-6 max-w-xl text-balance text-base leading-relaxed text-fg-muted sm:text-lg">
            Ferion matches an entire auction sale list against a proven parts catalog and
            tells you what each vehicle is worth in parts, how fast they sell, and where the
            coverage gaps are.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button href="/auctions" variant="accent" size="lg">
              Analyze an auction
            </Button>
            <Button href="/catalog" variant="ghost" size="lg">
              Browse the catalog →
            </Button>
          </div>
        </Container>
      </section>

      <section className="border-y border-line/10 bg-surface-raised/60 py-12">
        <Container className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <Stat label="Lots per run" value="500+" />
          <Stat label="Time to value a sale" value="< 2 min" />
          <Stat label="Catalog parts" value="100+" hint="with live sell-through" />
          <Stat label="Pre-2015 coverage" value="70%" tone="bright" hint="target" />
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <div className="mb-10 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-medium tracking-tight text-fg sm:text-3xl">Tools</h2>
            <span className="text-sm text-fg-subtle">{String(primaryNavItems.length).padStart(2, "0")}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {primaryNavItems.map((item) => (
              <Link key={item.href} href={item.href} className="group">
                <Card className="h-full transition-colors group-hover:border-accent-deep/60">
                  <div className="mb-10 flex h-24 items-center justify-center rounded-brand-md bg-surface">
                    <span aria-hidden className="h-8 w-8 rounded-[3px] bg-fg/90 transition-colors group-hover:bg-accent" />
                  </div>
                  <CardTitle>{item.label}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}

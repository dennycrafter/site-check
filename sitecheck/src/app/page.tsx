import Link from "next/link";
import { Footer } from "@/components/footer";

const GOALS = [
  {
    label: "Today",
    heading: "Get it right the first time.",
    text: "Every homeowner, even the least tech-savvy, is guided shot by shot and told instantly if a photo won't work. Fewer retakes, faster installs, fewer customers lost while they wait.",
  },
  {
    label: "Over time",
    heading: "Every survey makes the next one smarter.",
    text: "Every home is photographed the same way, and every surveyor decision is saved with its photo. That becomes a labeled library of real homes, so the AI gets more accurate and fewer homes need manual review.",
  },
];

const BUTTON =
  "inline-flex min-h-[var(--control-height)] w-full md:min-h-[72px] md:max-w-[360px] items-center justify-center rounded-brand px-6 py-3.5 text-[length:var(--text-button)] leading-tight font-bold text-accent no-underline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-accent";

export default function Home() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-5 pt-6 pb-12 md:px-12 md:pt-8 md:pb-8">
        <p className="text-xl font-bold tracking-tight text-accent">SiteCheck</p>

        <div className="mt-10 md:mt-0 md:flex md:flex-1 md:items-center">
          <div className="grid w-full gap-x-16 gap-y-8 md:grid-cols-2 md:gap-y-6">
            <div className="md:col-start-1">
              <h1 className="ui-hero text-accent">Guided photo checks for site surveys.</h1>
              <p className="ui-lead mt-4 text-[length:var(--text-muted)] text-ink-strong">
                Homeowners take the photos. AI checks each one on the spot. Surveyors get a ready-made verdict.
              </p>
            </div>

            <div className="grid gap-4 md:col-start-1 md:row-start-2">
              {GOALS.map((g) => (
                <section key={g.label} className="ui-card">
                  <p className="ui-eyebrow">{g.label}</p>
                  <h2 className="ui-subtitle text-accent">{g.heading}</h2>
                  <p className="mt-3 text-[length:var(--text-muted)] leading-normal text-ink-strong">{g.text}</p>
                </section>
              ))}
            </div>

            <div className="flex flex-col gap-4 md:col-start-2 md:row-span-2 md:row-start-1 md:items-center md:justify-center">
              <Link href="/start" className={`${BUTTON} bg-lime hover:brightness-95`}>
                Start demo
              </Link>
              <Link href="/review" className={`${BUTTON} border-[length:var(--brand-border-strong)] border-accent bg-white hover:bg-lime-soft`}>
                Surveyor dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

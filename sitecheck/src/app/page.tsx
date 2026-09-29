import Link from "next/link";
import { Footer } from "@/components/footer";

const GOALS = [
  {
    label: "Immediate impact",
    heading: "Get it right the first time.",
    text: "Every homeowner, even the least tech-savvy, is guided shot by shot and told instantly if a photo won't work. Fewer retakes, faster installs, fewer customers lost while they wait.",
  },
  {
    label: "Long-term impact",
    heading: "Every survey makes the next one smarter.",
    text: "Every home is photographed the same way, and every surveyor decision is saved with its photo. That becomes a labeled library of real homes, so the AI gets more accurate and fewer homes need manual review.",
  },
];

const BUTTON =
  "inline-flex ui-landing-button min-h-[52px] w-full items-center justify-center rounded-[10px] px-6 py-3 text-[17px] leading-tight font-semibold text-accent no-underline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-accent md:max-w-[280px]";

export default function Home() {
  return (
    <div className="ui-landing">
      <main className="ui-landing-main mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-5 pt-6 pb-12 md:px-12">
        <p className="text-xl font-bold tracking-tight text-accent">
          site-check
        </p>

        <div className="ui-landing-body mt-10 md:flex md:flex-1 md:items-center">
          <div className="ui-landing-grid grid w-full gap-x-16 gap-y-6 md:w-max md:max-w-full md:grid-cols-2">
            <div className="md:col-span-2 md:row-start-1">
              <h1 className="ui-hero ui-landing-hero text-accent md:whitespace-nowrap md:leading-[1.05]">
                Guided photo checks for site surveys.
              </h1>
              <p className="ui-lead ui-landing-lead mt-4 text-[length:var(--text-muted)] text-ink-strong">
                Homeowners take the photos. AI checks each one on the spot.
                Surveyors get a ready-made verdict.
              </p>
            </div>

            <div className="ui-landing-sections grid gap-6 md:col-start-1 md:row-start-2 md:[contain:inline-size]">
              {GOALS.map((g) => (
                <section
                  key={g.label}
                  className="border-l-[3px] border-[var(--brand-orange)] pl-5"
                >
                  <p className="ui-eyebrow ui-landing-eyebrow">{g.label}</p>
                  <h2 className="ui-subtitle ui-landing-heading text-accent">
                    {g.heading}
                  </h2>
                  <p className="ui-landing-text mt-3 text-[length:var(--text-muted)] leading-normal text-ink-strong">
                    {g.text}
                  </p>
                </section>
              ))}
            </div>

            <div className="ui-landing-actions flex flex-col gap-3 md:col-start-2 md:row-start-2 md:items-center md:justify-center md:[contain:inline-size]">
              <Link
                href="/start"
                className={`${BUTTON} bg-lime hover:brightness-95`}
              >
                Start demo
              </Link>
              <Link
                href="/review"
                className={`${BUTTON} border-[length:var(--brand-border-strong)] border-accent bg-white hover:bg-lime-soft`}
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

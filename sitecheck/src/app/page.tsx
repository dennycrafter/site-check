import Link from "next/link";
import { Footer } from "@/components/footer";
import { buttonClass } from "@/components/ui";

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

export default function Home() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center px-5 pt-16 pb-12 text-center md:pt-28">
        <h1 className="ui-hero text-5xl md:text-7xl">SiteCheck</h1>
        <p className="ui-lead mt-5 text-2xl font-semibold">Guided site photos for home battery installs.</p>
        <p className="ui-lead mt-3 text-muted">
          Homeowners take the photos. AI checks each one on the spot. Surveyors get a ready-made verdict.
        </p>

        <div className="mt-14 grid w-full gap-4 text-left md:grid-cols-2">
          {GOALS.map((g) => (
            <section key={g.label} className="ui-card">
              <p className="ui-eyebrow">{g.label}</p>
              <h2 className="ui-subtitle text-2xl">{g.heading}</h2>
              <p className="ui-muted mt-3">{g.text}</p>
            </section>
          ))}
        </div>

        <Link href="/start" className={buttonClass("primary", "mt-14 w-full max-w-xs")}>
          Start
        </Link>
      </main>

      <Footer />
    </>
  );
}

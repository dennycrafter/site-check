import Link from "next/link";
import { Footer } from "@/components/footer";
import { StartQr } from "@/components/start-qr";
import { buttonClass } from "@/components/ui";

const HOW_IT_WORKS = [
  {
    title: "Guided shots",
    body: "An outline on your live camera shows exactly how to frame the meter, walls and breaker box.",
  },
  {
    title: "Instant photo check",
    body: "Each photo is checked in seconds. If it is too dark, too close or the lid is shut, you get a plain retake tip.",
  },
  {
    title: "Ready for the surveyor",
    body: "Your photos arrive with a pre-filled qualification check, so fewer back-and-forth emails.",
  },
];

export default function Home() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <span className="text-lg font-bold tracking-tight text-gray-900">
          Site<span className="text-accent">Check</span>
        </span>
        <Link href="/review" className="text-sm font-semibold text-accent hover:underline">
          Surveyor queue
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16">
        <section className="grid items-center gap-10 py-8 md:grid-cols-[1fr_auto] md:py-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Home battery site survey</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl">
              SiteCheck
            </h1>
            <p className="mt-4 max-w-xl text-xl text-gray-700">
              Get your home battery site photos right the first time.
            </p>
            <p className="mt-3 max-w-xl text-base text-gray-600">
              Walk around your electric meter with your phone. We guide every shot and check it on the spot, so
              your survey is not held up by a blurry photo.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/start" className={buttonClass("primary", "px-7 text-lg")}>
                Start photo check
              </Link>
              <Link href="/review" className={buttonClass("secondary")}>
                Surveyor queue
              </Link>
            </div>
          </div>
          <div className="flex justify-center">
            <StartQr />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((item, i) => (
            <div key={item.title} className="rounded-2xl border border-gray-200 p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                {i + 1}
              </span>
              <h2 className="mt-3 text-base font-semibold text-gray-900">{item.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{item.body}</p>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}

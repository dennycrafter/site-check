import Link from "next/link";
import { DemoLinkForm } from "@/components/demo-link-form";
import { Footer } from "@/components/footer";
import { buttonClass } from "@/components/ui";

export default function Home() {
  return (
    <>
      <header className="mx-auto w-full max-w-5xl px-5 py-5">
        <span className="text-lg font-bold tracking-tight text-gray-900">
          Site<span className="text-accent">Check</span>
        </span>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16">
        <section className="max-w-2xl py-4 md:py-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Home battery site photos, checked on the spot</h1>
          <p className="mt-3 text-base text-gray-600">
            This demo shows two separate parts of Base Power&apos;s signup flow on one site. Customers only ever see
            their photo link. Surveyors work from the queue.
          </p>
        </section>

        <div className="grid items-start gap-6 md:grid-cols-2">
          <DemoLinkForm />

          <section className="flex flex-col rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <h2 className="text-xl font-bold text-gray-900">Surveyor queue</h2>
            <p className="mt-1 text-sm text-gray-500">Inside Base&apos;s internal tools</p>
            <p className="mt-5 text-sm text-gray-600">
              Every submitted home arrives with its photos, a preliminary check and a battery count. The surveyor makes
              the final decision.
            </p>
            <div className="mt-6">
              <Link href="/review" className={buttonClass("primary")}>
                Open surveyor queue
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

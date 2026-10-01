import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { MOBILE_DEMO_PATH } from "@/lib/demo";

export const metadata: Metadata = { title: "Start demo | site-check" };

const BUTTON =
  "inline-flex w-full items-center justify-center rounded-[10px] px-6 text-[20px] leading-tight font-semibold text-accent no-underline min-h-[64px] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-accent md:w-[280px]";

export default function TryPage() {
  return (
    <div className="flex h-dvh flex-col">
      <main className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col px-5 pt-6 md:px-12">
        <Link href="/" className="self-start text-xl font-bold tracking-tight text-accent no-underline">
          site-check
        </Link>
        <div className="flex flex-1 flex-col items-center justify-center gap-10 pb-6">
          <h1 className="ui-hero text-center text-accent md:text-[48px] md:leading-[1.05]">How are you viewing this?</h1>
          <div className="flex w-full max-w-[360px] flex-col gap-3 md:max-w-none md:flex-row md:justify-center">
            <Link href="/demo" className={`${BUTTON} bg-lime hover:brightness-95`}>
              Desktop
            </Link>
            <Link
              href={MOBILE_DEMO_PATH}
              className={`${BUTTON} border-[length:var(--brand-border-strong)] border-accent bg-white hover:bg-lime-soft`}
            >
              Mobile
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

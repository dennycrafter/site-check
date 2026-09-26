import type { Metadata } from "next";
import Link from "next/link";
import { StartForm } from "./start-form";

export const metadata: Metadata = { title: "Start photo check | SiteCheck" };

export default function StartPage() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-12 pt-6">
      <Link href="/" className="text-sm font-semibold text-accent">
        SiteCheck
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Where is the home?</h1>
      <p className="mt-2 text-base text-gray-600">
        Takes about 5 minutes. You&apos;ll be outside next to your electric meter.
      </p>
      <StartForm />
    </main>
  );
}

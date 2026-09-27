"use client";

import Link from "next/link";
import { Button, buttonClass } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-16 text-center">
      <h1 className="ui-title">Something went wrong</h1>
      <p className="ui-lead mt-3 text-muted">We could not load this page. Please try again in a moment.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonClass("secondary")}>
          Home
        </Link>
      </div>
    </main>
  );
}

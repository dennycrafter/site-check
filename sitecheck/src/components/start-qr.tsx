"use client";

import QRCode from "qrcode";
import Link from "next/link";
import { useEffect, useState } from "react";

const DEMO_QUERY = "name=Demo%20Customer&email=demo@example.com&austin=yes&solar=no&ref=DEMO-001";

export function StartQr() {
  const [qr, setQr] = useState<{ svg: string; url: string } | null>(null);

  useEffect(() => {
    const url = `${window.location.origin}/start?${DEMO_QUERY}`;
    QRCode.toString(url, { type: "svg", margin: 1, width: 220, color: { dark: "#111827", light: "#ffffff" } })
      .then((svg) => setQr({ svg, url }))
      .catch(() => setQr(null));
  }, []);

  return (
    <figure className="flex max-w-[260px] flex-col items-center gap-3">
      <div className="flex h-[220px] w-[220px] items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-white p-2">
        {qr ? (
          <a href={qr.url} aria-label="Open the demo customer link" className="h-full w-full">
            <div
              className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
              role="img"
              aria-label={`QR code for ${qr.url}`}
              dangerouslySetInnerHTML={{ __html: qr.svg }}
            />
          </a>
        ) : (
          <div className="h-full w-full animate-pulse rounded-xl bg-gray-100" />
        )}
      </div>
      <figcaption className="text-center">
        <span className="block text-sm font-medium text-gray-900">
          Scan with your phone. Opens as a customer arriving from their Base account.
        </span>
        <Link href="/start" className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
          Start without a link
        </Link>
      </figcaption>
    </figure>
  );
}

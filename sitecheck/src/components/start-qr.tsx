"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function StartQr() {
  const [qr, setQr] = useState<{ svg: string; url: string } | null>(null);

  useEffect(() => {
    const url = `${window.location.origin}/start`;
    QRCode.toString(url, { type: "svg", margin: 1, width: 220, color: { dark: "#111827", light: "#ffffff" } })
      .then((svg) => setQr({ svg, url }))
      .catch(() => setQr(null));
  }, []);

  return (
    <figure className="flex flex-col items-center gap-3">
      <div className="flex h-[220px] w-[220px] items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-white p-2">
        {qr ? (
          <div
            className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
            role="img"
            aria-label={`QR code for ${qr.url}`}
            dangerouslySetInnerHTML={{ __html: qr.svg }}
          />
        ) : (
          <div className="h-full w-full animate-pulse rounded-xl bg-gray-100" />
        )}
      </div>
      <figcaption className="text-center">
        <span className="block text-base font-semibold text-gray-900">Scan with your phone</span>
        {qr && <span className="block break-all text-xs text-gray-500">{qr.url}</span>}
      </figcaption>
    </figure>
  );
}

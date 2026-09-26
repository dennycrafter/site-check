import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { StartForm, type Prefill } from "./start-form";

export const metadata: Metadata = { title: "Start photo check | SiteCheck" };

function param(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

function yesNo(value: string | undefined): boolean | undefined {
  if (value?.toLowerCase() === "yes") return true;
  if (value?.toLowerCase() === "no") return false;
  return undefined;
}

export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const sp = await searchParams;
  const raw = {
    name: param(sp.name),
    email: param(sp.email),
    austin: param(sp.austin),
    solar: param(sp.solar),
  };
  const prefill: Prefill = {
    name: raw.name?.slice(0, 200),
    email: raw.email?.slice(0, 320),
    austin: yesNo(raw.austin),
    solar: yesNo(raw.solar),
    ref: param(sp.ref)?.slice(0, 100),
    address: param(sp.address)?.slice(0, 300),
  };
  const complete =
    !!prefill.name &&
    z.email().safeParse(prefill.email).success &&
    prefill.austin !== undefined &&
    prefill.solar !== undefined;
  const mode = complete ? "auto" : Object.values(raw).some(Boolean) ? "details" : "address";

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-12 pt-6">
      <Link href="/" className="text-sm font-semibold text-accent">
        SiteCheck
      </Link>
      <StartForm mode={mode} prefill={prefill} />
    </main>
  );
}

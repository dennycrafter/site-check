import Link from "next/link";
import { VerdictBadge } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";
import type { HomeRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { data, error } = await getSupabase()
    .from("homes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const homes = (data ?? []) as HomeRow[];

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8">
      <h1 className="text-2xl font-bold">Surveyor queue</h1>
      {error && <p className="mt-4 text-fail">Could not load homes: {error.message}</p>}
      <ul className="mt-6 divide-y divide-gray-200">
        {homes.map((h) => (
          <li key={h.id} className="py-3">
            <Link href={`/review/${h.id}`} className="flex items-center gap-3">
              <VerdictBadge verdict={h.verdict} />
              <span className="font-semibold">{h.customer_name}</span>
              <span className="text-gray-500">{h.reasons[0]?.message}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

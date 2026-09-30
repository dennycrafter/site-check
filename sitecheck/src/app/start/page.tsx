import { DemoLinkForm } from "@/components/demo-link-form";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { StartWelcome } from "@/components/start-welcome";
import { parseStartLink } from "@/lib/startLink";

/** Every visit reads the link details, so this page must never be served from a saved copy. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Start({ searchParams }: PageProps<"/start">) {
  const link = parseStartLink(await searchParams);
  if (link) return <StartWelcome link={link} />;
  return (
    <>
      <SiteHeader narrow />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-5 pt-8 pb-12 md:pt-16">
        <DemoLinkForm />
      </main>
      <Footer />
    </>
  );
}

import { DemoLinkForm } from "@/components/demo-link-form";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";

export default function Start() {
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

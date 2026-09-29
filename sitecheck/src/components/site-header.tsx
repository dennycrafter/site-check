import Link from "next/link";

/** Shared header for the home page and the surveyor pages. */
export function SiteHeader({ tag, narrow = false }: { tag?: string; narrow?: boolean }) {
  return (
    <header className={`ui-container ui-header${narrow ? " ui-container-narrow" : ""}`}>
      <Link href="/" className="ui-wordmark">
        site-check
      </Link>
      {tag && <span className="ui-header-tag">{tag}</span>}
    </header>
  );
}

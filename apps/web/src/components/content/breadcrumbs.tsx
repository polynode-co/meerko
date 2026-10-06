import { JsonLd } from "@/components/json-ld";
import { site } from "@/lib/site";

/** Visible breadcrumb plus BreadcrumbList markup. The last item is the current page. */
export function Breadcrumbs({ items }: { items: [label: string, path: string][] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: new URL(path, site.url).toString() })),
  };
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
      <ol className="flex flex-wrap gap-2">
        {items.map(([label, path], i) => (
          <li key={path} className="flex gap-2">
            {i > 0 && <span className="text-line">/</span>}
            {i === items.length - 1 ? (
              <span className="text-fg" aria-current="page">{label}</span>
            ) : (
              <a href={path} className="hover:text-accent">{label}</a>
            )}
          </li>
        ))}
      </ol>
      <JsonLd data={data} />
    </nav>
  );
}

import { JsonLd } from "@/components/json-ld";
import { crumb } from "@/components/lookout/kit";
import { site } from "@/lib/site";

/**
 * Lookout breadcrumb ("DOCS / GET STARTED"). `items` feed the BreadcrumbList markup (the last one is the current
 * page); `trail` is what's shown, when it differs (e.g. a group name in place of the page title).
 */
export function LkBreadcrumbs({ items, trail }: { items: [label: string, path: string][]; trail?: [label: string, path?: string][] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: new URL(path, site.url).toString() })),
  };
  const shown: [string, string?][] = trail ?? items.map(([l, p], i) => (i === items.length - 1 ? [l] : [l, p]));
  return (
    <nav aria-label="Breadcrumb" className={crumb}>
      <ol className="flex flex-wrap gap-2">
        {shown.map(([label, path], i) => (
          <li key={label} className="flex gap-2">
            {i > 0 && <span aria-hidden>/</span>}
            {path ? (
              <a href={path} className="hover:text-lk-fg">
                {label}
              </a>
            ) : (
              <span className="text-lk-muted" aria-current={i === shown.length - 1 ? "page" : undefined}>
                {label}
              </span>
            )}
          </li>
        ))}
      </ol>
      <JsonLd data={data} />
    </nav>
  );
}

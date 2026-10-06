/** Structured data for search engines. `<` is escaped so the JSON can't close the script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** schema.org FAQPage from question/answer pairs; `backticks` are plain text here. */
export function faqJsonLd(items: readonly (readonly string[])[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: (a ?? "").replaceAll("`", "") },
    })),
  };
}

"use client";

import { useEffect, useState } from "react";

/**
 * The nav's outer frame, pinned to the top of the window. On the landing page (`transparent`) it floats over
 * the hero art and takes the night background once the page scrolls; everywhere else it's solid from the start.
 * Its height is --lk-nav-h (globals.css), which sticky side menus offset by.
 */
export function NavFrame({ transparent, children }: { transparent: boolean; children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparent]);

  if (!transparent) return <header className="sticky top-0 z-40 h-[var(--lk-nav-h)] border-b border-lk-line bg-lk-bg">{children}</header>;
  return (
    <>
      <div aria-hidden className="h-[var(--lk-nav-h)]" />
      <header
        className={`fixed inset-x-0 top-0 z-40 h-[var(--lk-nav-h)] border-b transition-colors duration-200 ${scrolled ? "border-lk-line bg-lk-bg/85 backdrop-blur-md" : "border-transparent"}`}
      >
        {children}
      </header>
    </>
  );
}

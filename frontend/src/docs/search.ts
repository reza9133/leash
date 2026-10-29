// Full-text search over the documentation, built in the browser on first use: every page is rendered to static
// markup once and cut into sections at its h2 and h3 headings.
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { DOC_PAGES, loaderFor } from "./registry";

export interface Section {
  slug: string;
  pageTitle: string;
  heading: string;
  id: string;
  text: string;
}

export interface Hit {
  section: Section;
  score: number;
  snippet: string;
}

let building: Promise<Section[]> | null = null;

const LEAF = "p, li, td, th, dt, dd, pre, blockquote, figcaption";

export function getIndex(): Promise<Section[]> {
  if (building) return building;
  building = (async () => {
    const [{ renderToStaticMarkup }] = await Promise.all([import("react-dom/server")]);
    const out: Section[] = [];
    for (const page of DOC_PAGES) {
      const load = loaderFor(page.slug);
      if (!load) continue;
      try {
        const Body = (await load()).default;
        const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Body)));
        const doc = new DOMParser().parseFromString(html, "text/html");
        let current: Section = { slug: page.slug, pageTitle: page.title, heading: page.title, id: "", text: page.summary };
        out.push(current);
        doc.body.querySelectorAll(`h2, h3, ${LEAF}`).forEach((el) => {
          if (el.matches("h2, h3")) {
            current = { slug: page.slug, pageTitle: page.title, heading: (el.textContent ?? "").trim(), id: el.id, text: "" };
            out.push(current);
          } else if (!el.querySelector(LEAF)) {
            current.text += ` ${(el.textContent ?? "").replace(/\s+/g, " ").trim()}`;
          }
        });
      } catch {
        /* a page that cannot be rendered to text is simply not searchable */
      }
    }
    return out;
  })();
  return building;
}

export function search(index: Section[], query: string, limit = 8): Hit[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
  if (!terms.length) return [];
  const hits: Hit[] = [];
  for (const s of index) {
    const heading = s.heading.toLowerCase();
    const title = s.pageTitle.toLowerCase();
    const text = s.text.toLowerCase();
    let score = 0;
    let ok = true;
    for (const t of terms) {
      const inHeading = heading.includes(t);
      const inTitle = title.includes(t);
      const inText = text.includes(t);
      if (!inHeading && !inTitle && !inText) {
        ok = false;
        break;
      }
      score += (inHeading ? 8 : 0) + (inTitle ? 3 : 0) + (inText ? 1 + Math.min(3, text.split(t).length - 2) * 0.3 : 0);
    }
    if (!ok) continue;
    const at = text.indexOf(terms[0]);
    const snippet = at < 0 ? s.text.trim().slice(0, 140) : `${at > 50 ? "…" : ""}${s.text.slice(Math.max(0, at - 50), at + 110).trim()}…`;
    hits.push({ section: s, score, snippet });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Menu, Search } from "lucide-react";
import { useDocumentTitle } from "../lib/hooks";
import { DOC_GROUPS, DOC_PAGES, loaderFor, pageBySlug } from "../docs/registry";
import { DocSlugContext } from "../docs/kit";
import { getIndex, search, type Hit, type Section } from "../docs/search";
import { EmptyState } from "../components/ui";
import { Skeleton } from "../components/Spinners";

const lazyCache = new Map<string, ComponentType>();
function bodyFor(slug: string): ComponentType | null {
  const load = loaderFor(slug);
  if (!load) return null;
  let c = lazyCache.get(slug);
  if (!c) {
    c = lazy(load);
    lazyCache.set(slug, c);
  }
  return c;
}

// ---- search box ------------------------------------------------------------------------------------------------------------

function SearchBox() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<Section[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits: Hit[] = useMemo(() => (index && q.trim() ? search(index, q) : []), [index, q]);
  useEffect(() => setActive(0), [q]);

  const go = (h: Hit) => {
    setOpen(false);
    setQ("");
    nav(`/docs/${h.section.slug}${h.section.id ? `/${h.section.id}` : ""}`);
  };

  return (
    <div className="docs-search" role="search">
      <div className="affix">
        <span className="affix__unit" aria-hidden>
          <Search size={15} />
        </span>
        <input
          ref={input}
          className="input"
          type="search"
          placeholder="Search the docs"
          aria-label="Search the documentation"
          value={q}
          role="combobox"
          aria-expanded={open && q.trim().length > 0}
          aria-controls="docs-results"
          aria-autocomplete="list"
          onFocus={() => {
            setOpen(true);
            if (!index) void getIndex().then(setIndex);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(hits.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && hits[active]) {
              e.preventDefault();
              go(hits[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
              input.current?.blur();
            }
          }}
          data-testid="docs-search"
        />
        <kbd className="docs-kbd" aria-hidden>/</kbd>
      </div>
      {open && q.trim() && (
        <ul id="docs-results" className="docs-results" role="listbox" data-testid="docs-results">
          {!index && <li className="docs-results__note">Building the index…</li>}
          {index && hits.length === 0 && <li className="docs-results__note">Nothing found for “{q.trim()}”.</li>}
          {hits.map((h, i) => (
            <li key={`${h.section.slug}-${h.section.id}-${i}`} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? "is-active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => go(h)}>
                <strong>{h.section.heading}</strong>
                <span className="muted">{h.section.pageTitle}</span>
                <small>{h.snippet}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- table of contents ---------------------------------------------------------------------------------------------------------

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

function useToc(article: React.RefObject<HTMLElement | null>, slug: string) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [current, setCurrent] = useState<string>("");

  useEffect(() => {
    const el = article.current;
    if (!el) return;
    let timer = 0;
    const scan = () => {
      const found: TocItem[] = [];
      el.querySelectorAll<HTMLElement>("h2[id], h3[id]").forEach((h) => found.push({ id: h.id, text: (h.textContent ?? "").trim(), level: h.tagName === "H2" ? 2 : 3 }));
      setItems((prev) => (prev.length === found.length && prev.every((p, i) => p.id === found[i].id) ? prev : found));
    };
    scan();
    const mo = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(scan, 80);
    });
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      mo.disconnect();
    };
  }, [article, slug]);

  useEffect(() => {
    const el = article.current;
    if (!el || items.length === 0) return;
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
        const first = items.find((i) => visible.has(i.id));
        if (first) setCurrent(first.id);
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    items.forEach((i) => {
      const h = document.getElementById(i.id);
      if (h) io.observe(h);
    });
    return () => io.disconnect();
  }, [items, article]);

  return { items, current };
}

/** Scrolls to an anchor once the page body has rendered. Gives up after a few seconds. */
function useAnchorScroll(slug: string, anchor: string | undefined) {
  useEffect(() => {
    if (!anchor) {
      window.scrollTo({ top: 0, left: 0 });
      return;
    }
    let tries = 0;
    const timer = window.setInterval(() => {
      const el = document.getElementById(anchor);
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "start" });
        el.classList.add("docs-flash");
        window.setTimeout(() => el.classList.remove("docs-flash"), 1600);
        window.clearInterval(timer);
      } else if (++tries > 40) {
        window.clearInterval(timer);
      }
    }, 75);
    return () => window.clearInterval(timer);
  }, [slug, anchor]);
}

// ---- the page --------------------------------------------------------------------------------------------------------------------------

export default function Docs() {
  const { slug = "overview", anchor } = useParams();
  const page = pageBySlug(slug);
  useDocumentTitle(page ? page.title : "Docs");
  const article = useRef<HTMLElement>(null);
  const { items, current } = useToc(article, slug);
  useAnchorScroll(slug, anchor);
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [slug]);

  const index = DOC_PAGES.findIndex((p) => p.slug === slug);
  const prev = index > 0 ? DOC_PAGES[index - 1] : null;
  const next = index >= 0 && index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : null;
  const Body = page ? bodyFor(page.slug) : null;

  const nav = useCallback(
    () => (
      <nav className="docs-nav" aria-label="Documentation">
        {DOC_GROUPS.map((g) => (
          <div key={g} className="docs-nav__group">
            <h2>{g}</h2>
            <ul>
              {DOC_PAGES.filter((p) => p.group === g).map((p) => (
                <li key={p.slug}>
                  <Link to={`/docs/${p.slug}`} className={p.slug === slug ? "is-current" : ""} aria-current={p.slug === slug ? "page" : undefined}>
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    ),
    [slug],
  );

  if (!page) {
    return (
      <div className="page section">
        <EmptyState title="That documentation page does not exist" action={<Link to="/docs/overview" className="btn btn--primary btn--md"><span>Go to the overview</span></Link>}>
          Pick a page from the menu, or search for what you need.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="page docs">
      <aside className="docs-side">
        <SearchBox />
        <button type="button" className="docs-menu-toggle" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <Menu size={16} /> Docs menu
        </button>
        <div className={`docs-side__nav ${menu ? "is-open" : ""}`}>{nav()}</div>
      </aside>

      <div className="docs-main">
        <p className="docs-crumb">
          <Link to="/docs/overview">Docs</Link> <span aria-hidden>/</span> {page.group}
        </p>
        <article ref={article} className="docs-prose" data-testid="docs-article">
          <h1 className="docs-title">{page.title}</h1>
          <DocSlugContext.Provider value={page.slug}>
            {Body ? (
              <Suspense
                fallback={
                  <div className="stack" aria-busy>
                    <Skeleton height={20} width="80%" />
                    <Skeleton height={20} width="95%" />
                    <Skeleton height={20} width="70%" />
                  </div>
                }
              >
                <Body />
              </Suspense>
            ) : (
              <p className="docs-lead">{page.summary} This page is being written.</p>
            )}
          </DocSlugContext.Provider>
        </article>
        <nav className="docs-pager" aria-label="Previous and next page">
          {prev ? (
            <Link to={`/docs/${prev.slug}`} className="docs-pager__prev">
              <ChevronLeft size={18} />
              <span>
                <small>Previous</small>
                {prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/docs/${next.slug}`} className="docs-pager__next">
              <span>
                <small>Next</small>
                {next.title}
              </span>
              <ChevronRight size={18} />
            </Link>
          )}
        </nav>
      </div>

      <aside className="docs-toc" aria-label="On this page">
        {items.length > 1 && (
          <>
            <h2>On this page</h2>
            <ul>
              {items.map((i) => (
                <li key={i.id} className={i.level === 3 ? "is-sub" : ""}>
                  <Link to={`/docs/${slug}/${i.id}`} className={current === i.id ? "is-current" : ""}>
                    {i.text}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}

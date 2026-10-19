import { createElement, Fragment, useCallback, useMemo, useState, type ReactNode } from "react";
import ImageLightbox from "@/components/quiz/ImageLightbox";
import { EkgCanvas, isRhythm } from "@/components/ekg/EkgCanvas";
import OrchestraMethod from "@/components/course/OrchestraMethod";
import { InlineLectureImage, LectureFigure, type OpenImage } from "./LectureFigure";

/**
 * Treść rozdziału z oczyszczonego HTML. Węzły najwyższego poziomu stają się bezpośrednimi
 * dziećmi .prose-hk (zachowuje rytm odstępów `> * + *`). Zwykłe bloki idą jako innerHTML,
 * a elementy specjalne (obraz, żywe EKG, grafika w przygotowaniu, <details>) — jako komponenty.
 * DOMParser nie wykonuje skryptów; wejście jest już po DOMPurify.
 */

const VOID = new Set(["img", "br", "hr", "wbr", "col", "source", "area"]);
/** W tych rodzicach białe znaki między dziećmi są niedozwolone w DOM Reacta */
const NO_WS = new Set(["table", "thead", "tbody", "tfoot", "tr", "colgroup", "ul", "ol", "details"]);
const SPECIAL = "img, details, div[data-ekg], div[data-gfx-pending], div[data-widget]";
const ATTR_MAP: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  colspan: "colSpan",
  rowspan: "rowSpan",
  tabindex: "tabIndex",
  srcset: "srcSet",
  datetime: "dateTime",
};

interface Ctx {
  canSeeGaps: boolean;
  openImage: OpenImage;
}

function propsOf(el: Element, key: string): Record<string, unknown> {
  const props: Record<string, unknown> = { key };
  for (const a of Array.from(el.attributes)) {
    if (a.name === "open" || a.name.startsWith("on")) continue;
    props[ATTR_MAP[a.name] ?? a.name] = a.value;
  }
  return props;
}

const isBlank = (n: ChildNode) => n.nodeType === Node.TEXT_NODE && !(n.textContent ?? "").trim();

/** Akapit, w którym są tylko obrazy (tak marked opakowuje `![alt](src)`) */
function figureImages(p: Element): HTMLImageElement[] | null {
  const kids = Array.from(p.childNodes).filter((n) => !isBlank(n) && !(n instanceof HTMLBRElement));
  if (!kids.length || !kids.every((n) => n instanceof HTMLImageElement)) return null;
  return kids as HTMLImageElement[];
}

function renderChildren(parent: Element | DocumentFragment, ctx: Ctx, keyPrefix: string): ReactNode[] {
  const tag = parent instanceof Element ? parent.tagName.toLowerCase() : "";
  const out: ReactNode[] = [];
  Array.from(parent.childNodes).forEach((n, i) => {
    const node = renderNode(n, ctx, `${keyPrefix}.${i}`, tag === "" || tag === "body" || NO_WS.has(tag));
    if (node !== null) out.push(node);
  });
  return out;
}

function renderNode(n: ChildNode, ctx: Ctx, key: string, dropBlank: boolean): ReactNode {
  if (n.nodeType === Node.TEXT_NODE) {
    if (dropBlank && isBlank(n)) return null;
    return n.textContent;
  }
  if (!(n instanceof Element)) return null;
  const el = n;
  const tag = el.tagName.toLowerCase();

  if (tag === "div" && el.hasAttribute("data-ekg")) {
    const r = (el.getAttribute("data-ekg") ?? "").trim();
    const h = parseInt(el.getAttribute("data-height") ?? "", 10);
    const height = Number.isFinite(h) ? Math.min(240, Math.max(48, h)) : 90;
    if (isRhythm(r)) return <EkgCanvas key={key} rhythm={r} height={height} />;
    return ctx.canSeeGaps ? <GapNote key={key} text={`Nieznany rytm EKG: „${r || "—"}”`} /> : null;
  }

  // Interaktywne wstawki w treści wykładu (np. „Serce to orkiestra” przy rozdziale o drodze impulsu)
  if (tag === "div" && el.hasAttribute("data-widget")) {
    const w = (el.getAttribute("data-widget") ?? "").trim();
    if (w === "orchestra") {
      return (
        <div key={key} className="not-prose my-10 border-y border-[var(--line)] py-8 [text-align:left]">
          <OrchestraMethod header="none" level={3} />
        </div>
      );
    }
    return ctx.canSeeGaps ? <GapNote key={key} text={`Nieznana wstawka: „${w || "—"}”`} /> : null;
  }

  if (tag === "div" && el.hasAttribute("data-gfx-pending")) {
    const code = (el.getAttribute("data-gfx-pending") ?? "").trim();
    return ctx.canSeeGaps ? <GapNote key={key} text={`Ilustracja w przygotowaniu${code ? ` · ${code}` : ""}`} /> : null;
  }

  if (tag === "p") {
    const imgs = figureImages(el);
    if (imgs) {
      return (
        <Fragment key={key}>
          {imgs.map((img, i) => (
            <LectureFigure key={i} src={img.getAttribute("src") ?? ""} alt={img.getAttribute("alt") ?? ""} onOpen={ctx.openImage} />
          ))}
        </Fragment>
      );
    }
  }

  if (tag === "img") {
    return <InlineLectureImage key={key} src={el.getAttribute("src") ?? ""} alt={el.getAttribute("alt") ?? ""} onOpen={ctx.openImage} />;
  }

  if (tag === "details") return <RecallCard key={key} el={el} ctx={ctx} />;

  if (VOID.has(tag)) return createElement(tag, propsOf(el, key));
  if (el.querySelector(SPECIAL)) return createElement(tag, propsOf(el, key), ...renderChildren(el, ctx, key));
  return createElement(tag, { ...propsOf(el, key), dangerouslySetInnerHTML: { __html: el.innerHTML } });
}

/** Luka widoczna tylko dla redakcji: cienka przerywana ramka */
function GapNote({ text }: { text: string }) {
  return (
    <div
      className="rounded-[12px] border border-dashed border-[var(--line2)] px-4 py-3 text-center font-mono text-[11px] uppercase tracking-[.16em] text-[var(--label)]"
      data-testid="gfx-pending"
    >
      {text}
    </div>
  );
}

const RECALL_PREFIX = /^\s*przypomnij(\s+sobie)?\s*[:.–—-]?\s*/i;

/**
 * „Przypomnij sobie”: pytanie w Space Grotesk, odpowiedź odsłaniana płynnym rozwinięciem
 * <details> (animacja ::details-content w index.css). Inne <details> dostają ten sam
 * kształt karty, ale bez etykiety.
 */
function RecallCard({ el, ctx }: { el: Element; ctx: Ctx }) {
  const summary = Array.from(el.children).find((c) => c.tagName.toLowerCase() === "summary") ?? null;
  const rawText = summary?.textContent ?? "";
  const isRecall = RECALL_PREFIX.test(rawText) || /\?\s*$/.test(rawText);

  let questionHtml = "";
  if (summary) {
    const clone = summary.cloneNode(true) as Element;
    // Zdejmij „Przypomnij sobie:” z początku — etykieta mówi to samo
    const walker = clone.ownerDocument.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    let t = walker.nextNode();
    while (t && !(t.textContent ?? "").trim()) t = walker.nextNode();
    if (t && RECALL_PREFIX.test(t.textContent ?? "")) t.textContent = (t.textContent ?? "").replace(RECALL_PREFIX, "");
    questionHtml = clone.innerHTML.trim();
    if (!clone.textContent?.trim()) questionHtml = "";
  }

  const body = document.createDocumentFragment();
  Array.from(el.childNodes).forEach((c) => {
    if (c !== summary) body.appendChild(c.cloneNode(true));
  });

  return (
    <details
      className="!rounded-[16px] !border-[var(--line)] bg-[var(--panel)] !px-0 !pb-0"
      data-testid={isRecall ? "recall-card" : "details-card"}
    >
      <summary className="!flex min-h-[44px] select-none items-start justify-between gap-4 !px-5 !py-5 !font-normal transition-transform duration-[120ms] ease-out after:!hidden active:scale-[.995] sm:!px-6">
        <span className="grid min-w-0 gap-2">
          {isRecall && <span className="label label--g">Przypomnij sobie</span>}
          {questionHtml ? (
            <span
              className="font-heading text-[1.125rem] font-medium leading-[1.35] tracking-[-0.012em] text-[var(--txt)] [text-wrap:pretty]"
              dangerouslySetInnerHTML={{ __html: questionHtml }}
            />
          ) : (
            <span className="font-heading text-[1.125rem] font-medium leading-[1.35] tracking-[-0.012em] text-[var(--txt)]">
              Pokaż odpowiedź
            </span>
          )}
        </span>
        <span className="module-i mt-0.5 shrink-0" aria-hidden="true">
          <svg viewBox="0 0 16 16" focusable="false">
            <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </summary>
      <div className="grid gap-3 border-t border-[var(--line)] px-5 py-5 sm:px-6">{renderChildren(body, ctx, "d")}</div>
    </details>
  );
}

export function LectureContent({ html, canSeeGaps }: { html: string; canSeeGaps: boolean }) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string; origin: HTMLElement } | null>(null);
  const openImage = useCallback<OpenImage>((src, alt, origin) => setLightbox({ src, alt, origin }), []);

  const body = useMemo(() => {
    if (typeof DOMParser === "undefined") return null;
    return new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html").body;
  }, [html]);

  const ctx: Ctx = { canSeeGaps, openImage };

  return (
    <>
      <div className="prose-hk max-w-none" data-testid="chapter-content">
        {body ? renderChildren(body, ctx, "c") : <div dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
      {lightbox && (
        <ImageLightbox
          imageUrl={lightbox.src}
          alt={lightbox.alt || "Powiększona ilustracja"}
          origin={lightbox.origin}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

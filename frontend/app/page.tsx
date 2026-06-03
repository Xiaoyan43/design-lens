"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const BUILDING_TYPES = [
  "townhouse",
  "standalone_house",
  "apartment",
  "mixed_use",
  "commercial_office",
  "retail_hospitality",
  "civic_cultural",
  "educational",
  "industrial",
  "landscape_urban",
  "interior",
  "unknown",
];

type Attributes = {
  building_type: string;
  architectural_style: string[];
  primary_materials: string[];
  storeys: string | null;
  key_features: string[];
  setting: string;
  colour_palette: string[];
  mood_tags: string[];
};
type Copy = {
  description_en: string;
  description_zh: string;
  alt_text_en: string;
  alt_text_zh: string;
  seo_keywords: string[];
};
type Extraction = {
  attributes: Attributes;
  copy: Copy;
  confidence: number;
  low_confidence_fields: string[];
  model: string;
};
type Card = {
  id: string;
  created_at: string;
  image_url: string;
  building_type: string;
  setting: string;
  materials: string;
  styles: string;
  description_en: string;
  confidence: number;
  result: Extraction;
};

const pct = (n: number) => `${Math.round((n ?? 0) * 100)}%`;

function Chips({ items }: { items: string[] }) {
  if (!items || items.length === 0) return <span style={{ color: "var(--faint)" }}>—</span>;
  return (
    <div className="chip-row">
      {items.map((t, i) => (
        <span className="chip" key={`${t}-${i}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

function Modal({ card, onClose }: { card: Card; onClose: () => void }) {
  const [show, setShow] = useState(false);
  const a = card.result.attributes;
  const c = card.result.copy;

  const close = useCallback(() => {
    setShow(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  return (
    <div className={`overlay${show ? " show" : ""}`} onClick={close}>
      <div className={`modal${show ? " show" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-figure">
          <img className="modal-img" src={`${API}${card.image_url}`} alt={c.alt_text_en} />
        </div>
        <div className="modal-body">
          <div className="modal-head">
            <div>
              <div className="modal-title">{a.building_type.replace(/_/g, " ")}</div>
              <div style={{ marginTop: 7 }}>
                <span className={`score${card.result.confidence < 0.5 ? " low" : ""}`}>
                  confidence {pct(card.result.confidence)}
                </span>
              </div>
            </div>
            <button className="close" onClick={close} aria-label="Close">
              ✕
            </button>
          </div>

          {card.result.low_confidence_fields?.length > 0 && (
            <p className="warn" style={{ marginTop: 14 }}>
              Low confidence — review: {card.result.low_confidence_fields.join(", ")}
            </p>
          )}

          <div className="field-label">Style</div>
          <Chips items={a.architectural_style} />
          <div className="field-label">Materials</div>
          <Chips items={a.primary_materials} />
          <div className="field-label">Key features</div>
          <Chips items={a.key_features} />
          <div className="field-label">Setting · storeys · palette</div>
          <Chips
            items={[
              a.setting,
              a.storeys ? `${a.storeys} storeys` : "",
              ...a.colour_palette,
            ].filter(Boolean)}
          />

          <div className="field-label">Copy</div>
          <p className="desc">
            <span className="lang">EN</span>
            {c.description_en}
          </p>
          <p className="desc">
            <span className="lang">中文</span>
            {c.description_zh}
          </p>
          <div className="field-label">SEO keywords</div>
          <Chips items={c.seo_keywords} />

          <p className="codeblock">model · {card.result.model}</p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<Card[]>([]);
  const [q, setQ] = useState("");
  const [buildingType, setBuildingType] = useState("");
  const [selected, setSelected] = useState<Card | null>(null);

  const loadAssets = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (buildingType) params.set("building_type", buildingType);
    try {
      const res = await fetch(`${API}/assets?${params.toString()}`);
      if (res.ok) setAssets(await res.json());
    } catch {
      /* backend offline */
    }
  }, [q, buildingType]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const analyse = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${API}/extract`, { method: "POST", body: fd });
        const body = await res.json();
        if (!res.ok) throw new Error(body.detail ?? res.statusText);
        await loadAssets();
        setSelected(body as Card);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [loadAssets],
  );

  function onInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) analyse(file);
    e.target.value = "";
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) analyse(file);
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <span className="logo" />
          <span className="wordmark">DesignLens</span>
          <span className="badge">Demo</span>
          <span className="spacer" />
          <span className="sub">AI cataloguing for design studios</span>
        </div>
      </header>

      <main className="container">
        <div className="kicker">DesignLens — AI cataloguing</div>
        <h1 className="hero">
          A studio&apos;s work,
          <br />
          <em>catalogued.</em>
        </h1>
        <p className="lead">
          Drop in a building image and it&apos;s analysed into structured attributes and bilingual
          (EN&nbsp;/&nbsp;中文) copy, then saved to a searchable library. Sample images only · vision via
          the Claude API, validated server-side, with low-confidence fields flagged for review.
        </p>

        <div
          className={`dropzone${dragging ? " drag" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <strong>{loading ? "Analysing…" : "Drop a building image here, or click to choose"}</strong>
          <div className="hint">JPG / PNG / WebP · the result is saved to the library below</div>
          <input ref={inputRef} type="file" accept="image/*" onChange={onInput} hidden />
        </div>
        {error && (
          <p className="error" style={{ marginTop: 12 }}>
            Error: {error}
          </p>
        )}

        <div className="eyebrow">Library</div>
        <div className="filters">
          <input
            className="input"
            placeholder="Search e.g. coastal timber, brutalist, glass…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="select" value={buildingType} onChange={(e) => setBuildingType(e.target.value)}>
            <option value="">All building types</option>
            {BUILDING_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {assets.length === 0 ? (
          <div className="empty">No items yet — drop an image above to start the library.</div>
        ) : (
          <div className="grid">
            {assets.map((a, i) => (
              <div
                className="asset"
                key={a.id}
                style={{ animationDelay: `${Math.min(i * 45, 360)}ms` }}
                onClick={() => setSelected(a)}
              >
                <div className="asset-thumb-wrap">
                  <img className="asset-thumb" src={`${API}${a.image_url}`} alt={a.result.copy.alt_text_en} />
                </div>
                <div className="asset-body">
                  <div className="asset-title">
                    <span>{a.building_type.replace(/_/g, " ")}</span>
                    <span className={`score${a.confidence < 0.5 ? " low" : ""}`}>{pct(a.confidence)}</span>
                  </div>
                  <div className="asset-sub">{a.styles || "—"}</div>
                  <div className="asset-meta">
                    {a.materials || "—"} · {a.setting}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selected && <Modal card={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

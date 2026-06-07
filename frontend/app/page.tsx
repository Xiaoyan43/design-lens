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
const padIndex = (n: number) => String(n + 1).padStart(2, "0");

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
          <span className="modal-frame-tl" aria-hidden />
          <span className="modal-frame-tr" aria-hidden />
          <span className="modal-frame-bl" aria-hidden />
          <span className="modal-frame-br" aria-hidden />
          <img className="modal-img" src={`${API}${card.image_url}`} alt={c.alt_text_en} />
        </div>
        <div className="modal-body">
          <div className="modal-head">
            <div>
              <div className="modal-kicker">Catalogue entry</div>
              <div className="modal-title">{a.building_type.replace(/_/g, " ")}</div>
              <div className="modal-confidence">
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
            <p className="warn" style={{ marginTop: 16 }}>
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
          <span className="logo" aria-hidden />
          <span className="wordmark">DesignLens</span>
          <span className="badge">Studio Demo</span>
          <span className="spacer" />
          <span className="sub">AI cataloguing · EN / 中文</span>
        </div>
      </header>

      <div className="page-shell">
      <section className="hero-panel">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="kicker">Architecture archive</div>
            <h1 className="hero">
              A studio&apos;s work,
              <br />
              <em>catalogued.</em>
            </h1>
            <p className="lead">
              Drop in a building image — structured attributes and bilingual copy, validated
              server-side and saved to your searchable library.
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-val">{assets.length} assets</span>
                <span className="stat-label">In library</span>
              </div>
              <div className="stat">
                <span className="stat-val">EN · 中文</span>
                <span className="stat-label">Bilingual copy</span>
              </div>
              <div className="stat">
                <span className="stat-val">Claude vision</span>
                <span className="stat-label">Extraction</span>
              </div>
            </div>
          </div>

          <div className="dropzone-wrap">
            <div
              className={`dropzone${dragging ? " drag" : ""}${loading ? " loading" : ""}`}
              onClick={() => !loading && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <span className="corner-bl" aria-hidden />
              <span className="corner-br" aria-hidden />
              <div className="dropzone-icon" aria-hidden>
                +
              </div>
              <strong>
                {loading ? "Analysing image…" : "Drop a building image, or click to browse"}
              </strong>
              <div className="hint">JPG · PNG · WebP · saved to library</div>
              <div className="dropzone-loader">
                <div className="loader-ring" />
                <span className="loader-text">Extracting attributes</span>
              </div>
              <input ref={inputRef} type="file" accept="image/*" onChange={onInput} hidden />
            </div>
            {error && <p className="error">Error: {error}</p>}
          </div>
        </div>
      </section>

      <main className="container library-panel">
        <div className="library-head">
          <div className="eyebrow">Project library</div>
          <div className="library-count">
            <span>{assets.length}</span> catalogue entries
          </div>
        </div>

        <div className="filters">
          <input
            className="input"
            placeholder="Search materials, styles, setting…"
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
          <div className="empty">No catalogue entries yet — upload an image above to begin.</div>
        ) : (
          <div className="grid">
            {assets.map((a, i) => (
              <div
                className="asset"
                key={a.id}
                style={{ animationDelay: `${Math.min(i * 60, 480)}ms` }}
                onClick={() => setSelected(a)}
              >
                <span className="asset-index">{padIndex(i)}</span>
                <div className="asset-thumb-wrap">
                  <img
                    className="asset-thumb"
                    src={`${API}${a.image_url}`}
                    alt={a.result.copy.alt_text_en}
                  />
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
      </div>

      {selected && <Modal card={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

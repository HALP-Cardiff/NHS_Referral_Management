"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (base) return `${base}${path}`;
  return path;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type FieldEntry = {
  label: string;
  value: string;
  section: string;
};

type MissingField = {
  key: string;
  label: string;
  section: string;
};

type AnalysisResult = {
  pathway: string;
  references: string;
  clinicalReasoning: string;
  raw: string;
};

type ParsedJson = {
  numpages: number;
  meta: {
    title: string | null;
    author: string | null;
    subject: string | null;
  };
  fields: Record<string, FieldEntry>;
  isValid: boolean;
};

type DocSummary = {
  id: number;
  original_filename: string;
  mime_type: string | null;
  page_count: number | null;
  uploaded_at: string;
  text_excerpt?: string;
  parsed_json?: ParsedJson | null;
  analysis_json?: AnalysisResult | null;
  has_video?: boolean;
  video_original_filename?: string | null;
  video_mime_type?: string | null;
};

type DocDetail = DocSummary & { raw_text?: string };

type UploadErrorBody = {
  error: string;
  missing_fields?: MissingField[];
  partial_result?: {
    fields: Record<string, FieldEntry>;
    meta: { title: string | null; author: string | null; subject: string | null };
    numpages: number;
  };
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const SECTION_ORDER = ["patient", "clinical", "environment"] as const;
const SECTION_LABELS: Record<string, string> = {
  patient: "Patient Observed States",
  clinical: "Clinical Decisions",
  environment: "Environment Observed States",
};

function groupFieldsBySection(fields: Record<string, FieldEntry>) {
  const grouped: Record<string, FieldEntry[]> = {};
  for (const entry of Object.values(fields)) {
    if (!grouped[entry.section]) grouped[entry.section] = [];
    grouped[entry.section].push(entry);
  }
  return grouped;
}

function formatUploadedAt(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function hasFields(doc: DocDetail | null): boolean {
  if (!doc) return false;
  return (
    !!doc.parsed_json?.fields &&
    Object.keys(doc.parsed_json.fields).length > 0
  );
}

function displaySummaryText(doc: DocDetail): string {
  const pick = (s: string | null | undefined) => {
    const t = typeof s === "string" ? s.trim() : "";
    return t.length > 0 ? t : "";
  };
  const raw = pick(doc.raw_text);
  if (raw) return raw;
  const excerpt = pick(doc.text_excerpt);
  if (excerpt) return excerpt;
  return "No extractable body text was found for this PDF.";
}

function AnalysisIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm4.22 2.22a1 1 0 0 1 1.41 0l1.42 1.41a1 1 0 1 1-1.42 1.42L16.22 5.63a1 1 0 0 1 0-1.41ZM20 11a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2h-2Zm-2.93 5.36a1 1 0 0 1 1.41 0l1.42 1.41a1 1 0 1 1-1.42 1.42l-1.41-1.42a1 1 0 0 1 0-1.41ZM12 18a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1Zm-5.64-1.22a1 1 0 0 1 0 1.41l-1.41 1.42a1 1 0 1 1-1.42-1.42l1.42-1.41a1 1 0 0 1 1.41 0ZM4 11a1 1 0 1 0 0 2H2a1 1 0 1 0 0-2h2Zm.93-4.36a1 1 0 0 1 0-1.41L6.34 3.8a1 1 0 1 1 1.42 1.42L6.34 6.64a1 1 0 0 1-1.41 0ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
    </svg>
  );
}

function renderMarkdownBlock(md: string) {
  const lines = md.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="ml-4 list-disc space-y-1">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed text-[var(--foreground)]">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  }

  function renderInline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="rounded bg-[var(--surface-2)] px-1 py-0.5 text-xs font-mono">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  }

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
      listItems.push(content);
      continue;
    }

    flushList();

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h5 key={elements.length} className="mt-3 mb-1.5 text-sm font-semibold text-[var(--foreground)]">
          {trimmed.slice(4)}
        </h5>
      );
    } else if (trimmed.length === 0) {
      elements.push(<div key={elements.length} className="h-2" />);
    } else {
      elements.push(
        <p key={elements.length} className="text-sm leading-relaxed text-[var(--foreground)]">
          {renderInline(trimmed)}
        </p>
      );
    }
  }

  flushList();
  return <>{elements}</>;
}

const pickerButtonClass =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[color:color-mix(in_oklch,var(--accent)_20%,var(--line))] bg-[var(--surface)] px-6 py-2.5 text-[1.05rem] font-semibold text-[var(--accent-strong)] shadow-[0_8px_22px_color-mix(in_oklch,var(--accent)_10%,transparent)] transition duration-200 ease-out hover:border-[var(--accent)] hover:shadow-[0_10px_24px_color-mix(in_oklch,var(--accent)_14%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function VideoGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm2 0v8h12V8H6Zm3.5 2.25a.75.75 0 0 1 .45.15l2.75 1.83a.75.75 0 0 1 0 1.24l-2.75 1.83A.75.75 0 0 1 8.5 14.5v-3.5a.75.75 0 0 1 .75-.75Z" />
    </svg>
  );
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [selected, setSelected] = useState<DocDetail | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<UploadErrorBody | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  function isPdf(candidate: File) {
    return (
      candidate.type === "application/pdf" ||
      candidate.name.toLowerCase().endsWith(".pdf")
    );
  }

  function isVideo(candidate: File) {
    const m = (candidate.type || "").toLowerCase();
    if (m === "video/mp4" || m === "video/webm" || m === "video/quicktime")
      return true;
    const n = candidate.name.toLowerCase();
    return n.endsWith(".mp4") || n.endsWith(".webm") || n.endsWith(".mov");
  }

  function selectFile(candidate: File | null) {
    if (!candidate) {
      setFile(null);
      return;
    }
    if (!isPdf(candidate)) {
      setError("Please choose a PDF file.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setError(null);
    setUploadError(null);
    setFile(candidate);
  }

  function selectVideo(candidate: File | null) {
    if (!candidate) {
      setVideoFile(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    if (!file) {
      setError("Select a referral PDF before attaching a video.");
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    if (!isVideo(candidate)) {
      setError("Please choose an MP4, WebM, or MOV file.");
      setVideoFile(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    setError(null);
    setVideoFile(candidate);
  }

  function clearVideo() {
    setVideoFile(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  function clearSelectedFile() {
    setFile(null);
    setVideoFile(null);
    setError(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  const loadList = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const r = await fetch(apiUrl("/api/documents"));
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as { documents: DocSummary[] };
      setDocs(data.documents);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load document list"
      );
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function loadDetail(id: number) {
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/documents/${id}`));
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }
      const doc = (await r.json()) as DocDetail;
      setSelected(doc);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load document details"
      );
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (videoFile) fd.append("video", videoFile);
      const r = await fetch(apiUrl("/api/documents"), {
        method: "POST",
        body: fd,
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (body.missing_fields) {
          setUploadError(body as UploadErrorBody);
        } else {
          setError(
            typeof body.error === "string" ? body.error : `HTTP ${r.status}`
          );
        }
        return;
      }
      const doc = body as DocDetail;
      setFile(null);
      setVideoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
      await loadList();
      setSelected(doc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: DocSummary) {
    const confirmed = window.confirm(
      `Delete ${doc.original_filename}? This cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingId(doc.id);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/documents/${doc.id}`), {
        method: "DELETE",
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(
          typeof body.error === "string" ? body.error : `HTTP ${r.status}`
        );
      }
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      if (selected?.id === doc.id) setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete document");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAnalyse(docId: number) {
    setAnalysing(true);
    setAnalysisError(null);
    try {
      const r = await fetch(apiUrl(`/api/documents/${docId}/analyse`), {
        method: "POST",
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : `HTTP ${r.status}`
        );
      }
      const doc = body as DocDetail;
      setSelected(doc);
    } catch (e) {
      setAnalysisError(
        e instanceof Error ? e.message : "Analysis failed"
      );
    } finally {
      setAnalysing(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  const selectedFields = selected?.parsed_json?.fields ?? {};
  const grouped = groupFieldsBySection(selectedFields);
  const showFieldGrid = hasFields(selected);

  return (
    <div className="triage-shell min-h-full">
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-6 px-4 py-5 sm:px-7 sm:py-8">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="section-enter panel delay-1 overflow-hidden p-5 sm:p-7">
          <div className="grid gap-4 md:grid-cols-[1.3fr_1fr] md:items-end">
            <div>
              <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                NHS Referral Management
              </p>
              <h1 className="font-display text-[clamp(1.75rem,3.8vw,3.3rem)] font-[700] leading-[0.97] tracking-[-0.01em] text-[var(--foreground)]">
                ALAC-a-zam
              </h1>
            </div>
          </div>
        </header>

        {/* ── Simple error banner ─────────────────────────────── */}
        {error ? (
          <div
            className="section-enter delay-1 rounded-xl border border-[color:color-mix(in_oklch,var(--danger)_30%,var(--line))] bg-[color:color-mix(in_oklch,var(--danger)_10%,var(--surface))] px-4 py-3 text-sm text-[color:color-mix(in_oklch,var(--danger)_68%,var(--foreground))]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {/* ── Missing-fields error panel ─────────────────────── */}
        {uploadError?.missing_fields && (
          <div
            className="section-enter delay-1 rounded-xl border border-[color:color-mix(in_oklch,var(--danger)_30%,var(--line))] bg-[color:color-mix(in_oklch,var(--danger)_6%,var(--surface))] p-5"
            role="alert"
          >
            <h3 className="text-base font-semibold text-[color:color-mix(in_oklch,var(--danger)_70%,var(--foreground))]">
              Required Fields Missing
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              The following fields could not be extracted from the uploaded PDF.
              Ensure all required fields are filled in the ALAC Screening Form.
            </p>
            {SECTION_ORDER.map((sectionKey) => {
              const missing = uploadError.missing_fields!.filter(
                (f) => f.section === sectionKey
              );
              if (!missing.length) return null;
              return (
                <div key={sectionKey} className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                    {SECTION_LABELS[sectionKey]}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {missing.map((f) => (
                      <li
                        key={f.key}
                        className="flex items-center gap-2 text-sm text-[color:color-mix(in_oklch,var(--danger)_68%,var(--foreground))]"
                      >
                        <span className="text-xs">&#10005;</span>
                        {f.label}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {/* Show partially extracted fields */}
            {uploadError.partial_result &&
              Object.keys(uploadError.partial_result.fields).length > 0 && (
                <details className="mt-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--ink-soft)] hover:text-[var(--foreground)]">
                    Show partially extracted fields
                  </summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {Object.values(uploadError.partial_result.fields).map(
                      (f) => (
                        <div
                          key={f.label}
                          className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5"
                        >
                          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                            {f.label}
                          </p>
                          <p className="mt-1 text-xs text-[var(--foreground)]">
                            {f.value}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </details>
              )}
          </div>
        )}

        {/* ── Upload ─────────────────────────────────────────── */}
        <section className="section-enter panel delay-2 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[1.55rem] font-semibold tracking-tight text-[var(--foreground)]">
                Upload
              </h2>
              <p className="text-sm text-[var(--ink-soft)]">
                Add an ALAC Screening Form (PDF) for parsing and review.
              </p>
            </div>
          </div>
          <form className="mt-4 grid gap-4" onSubmit={handleUpload}>
            <div className="min-w-0">
              <input
                id="referral-pdf"
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
              />
              <input
                id="referral-video"
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                className="sr-only"
                onChange={(e) => selectVideo(e.target.files?.[0] ?? null)}
              />
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragActive(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (!dropped) return;
                  if (isPdf(dropped)) {
                    selectFile(dropped);
                  } else if (isVideo(dropped)) {
                    if (!file) {
                      setError(
                        "Select or drop a PDF before adding a video (MP4, WebM, or MOV)."
                      );
                      return;
                    }
                    selectVideo(dropped);
                  } else {
                    setError(
                      "Please drop a PDF referral file, or a supported video after a PDF is selected."
                    );
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Drop a PDF here or browse files; add a video after a PDF is selected"
                className={`flex cursor-pointer rounded-2xl border-2 border-dashed transition duration-200 ease-out ${
                  file
                    ? "min-h-[92px] items-center justify-between gap-3 px-4 py-3 text-left"
                    : "min-h-[230px] flex-col items-center justify-center px-5 py-7 text-center"
                } ${
                  isDragActive
                    ? "border-[var(--accent-strong)] bg-[color:color-mix(in_oklch,var(--accent)_14%,var(--surface))]"
                    : "border-[color:color-mix(in_oklch,var(--line)_88%,var(--surface))] bg-[color:color-mix(in_oklch,var(--surface-2)_86%,white)] hover:border-[var(--accent)] hover:bg-[color:color-mix(in_oklch,var(--accent)_7%,var(--surface-2))]"
                }`}
              >
                {file ? (
                  <>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex w-fit max-w-full items-center gap-2 rounded-lg border border-[#d96363] bg-[#e87878] px-2.5 py-2"
                      >
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#dc6666] text-white">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Zm0 2.5L16.5 7H14V4.5ZM8 11.25c0-.41.34-.75.75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75Zm0 3.5c0-.41.34-.75.75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75Z" />
                          </svg>
                        </span>
                        <span className="truncate text-sm font-semibold text-white">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={(e) => {
                            e.stopPropagation();
                            clearSelectedFile();
                          }}
                          className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#cc5959] bg-[#dc6666] text-sm font-bold text-white transition hover:bg-[#cf5e5e] disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Clear selected file"
                        >
                          &times;
                        </button>
                      </div>

                      {videoFile ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex min-w-0 max-w-[min(100%,420px)] items-center gap-2 rounded-lg border border-[color:color-mix(in_oklch,var(--accent)_35%,var(--line))] bg-[color:color-mix(in_oklch,var(--accent)_12%,var(--surface))] px-2.5 py-2"
                        >
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[color:color-mix(in_oklch,var(--accent)_22%,var(--surface))] text-[var(--accent-strong)]">
                            <VideoGlyph className="h-4 w-4" />
                          </span>
                          <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                            {videoFile.name}
                          </span>
                          <button
                            type="button"
                            disabled={uploading}
                            onClick={(e) => {
                              e.stopPropagation();
                              clearVideo();
                            }}
                            className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[color:color-mix(in_oklch,var(--accent)_28%,var(--line))] bg-[var(--surface)] text-sm font-bold text-[var(--accent-strong)] transition hover:bg-[color:color-mix(in_oklch,var(--accent)_8%,var(--surface))] disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Remove attached video"
                          >
                            &times;
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={(e) => {
                            e.stopPropagation();
                            videoInputRef.current?.click();
                          }}
                          className={`${pickerButtonClass} w-fit max-w-full py-2 text-sm`}
                        >
                          <VideoGlyph className="h-4 w-4 shrink-0" />
                          Attach video (optional)
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={uploading}
                      onClick={(e) => e.stopPropagation()}
                      className="h-12 w-[170px] shrink-0 cursor-pointer self-start rounded-xl border border-transparent bg-[linear-gradient(95deg,color-mix(in_oklch,var(--accent-strong)_96%,black),color-mix(in_oklch,var(--accent)_88%,white))] px-4 text-base font-semibold text-[var(--surface)] shadow-[0_10px_22px_color-mix(in_oklch,var(--accent)_24%,transparent)] transition duration-200 ease-out hover:translate-y-[-1px] hover:shadow-[0_14px_26px_color-mix(in_oklch,var(--accent)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 sm:self-center"
                    >
                      {uploading ? "Uploading..." : "Upload"}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:color-mix(in_oklch,var(--accent)_14%,var(--surface))] text-[var(--accent-strong)]">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-6 w-6"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M12 3a6 6 0 0 0-5.915 5H6a5 5 0 0 0 0 10h12a4 4 0 0 0 .65-7.947A6.002 6.002 0 0 0 12 3Zm0 4.5a.75.75 0 0 1 .75.75v4.19l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V8.25A.75.75 0 0 1 12 7.5Z" />
                      </svg>
                    </span>
                    <p className="text-[clamp(1.28rem,1.85vw,1.8rem)] font-semibold tracking-tight text-[var(--foreground)]">
                      Drag and drop ALAC Screening Form
                    </p>
                    <p className="mt-1.5 max-w-[46ch] text-[0.95rem] text-[var(--ink-soft)]">
                      Upload a PDF referral form to automatically extract and
                      validate all fields. You can also attach an optional MP4,
                      WebM, or MOV clip.
                    </p>
                    <p className="mt-4 text-xs font-medium text-[var(--ink-soft)]">
                      No PDF selected
                    </p>
                    <p className="mt-1 max-w-[46ch] text-xs text-[var(--ink-soft)]">
                      Video upload stays disabled until a referral PDF is
                      selected.
                    </p>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-4 flex flex-wrap items-center justify-center gap-3"
                    >
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className={pickerButtonClass}
                      >
                        Browse Files
                      </button>
                      <button
                        type="button"
                        disabled={uploading || !file}
                        title={
                          !file
                            ? "Select a referral PDF first to attach a video"
                            : undefined
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!file) return;
                          videoInputRef.current?.click();
                        }}
                        className={pickerButtonClass}
                      >
                        <VideoGlyph className="h-5 w-5 shrink-0" />
                        Video upload
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </form>
        </section>

        {/* ── Queue + Detail ─────────────────────────────────── */}
        <section className="section-enter panel delay-3 flex min-h-[320px] max-h-[calc(100dvh-10rem)] flex-col overflow-y-auto overscroll-contain md:overflow-hidden">
          <div className="grid min-h-0 flex-1 md:grid-cols-[320px_minmax(0,1fr)]">
            {/* Queue sidebar */}
            <div className="flex max-h-[min(42vh,22rem)] min-h-0 flex-col border-b border-[var(--line)] bg-[var(--surface-2)] p-3 md:max-h-none md:border-b-0 md:border-r">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--foreground)]">
                  Queue
                </h2>
                <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ink-soft)]">
                  {docs.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => loadList()}
                className="mb-2 cursor-pointer rounded-md px-1.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
              >
                Refresh
              </button>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 sm:min-h-[200px]">
                {listLoading ? (
                  <p className="px-2 py-4 text-sm text-[var(--ink-soft)]">
                    Loading...
                  </p>
                ) : docs.length === 0 ? (
                  <p className="px-2 py-4 text-sm leading-relaxed text-[var(--ink-soft)]">
                    No referrals queued yet. Upload a PDF to begin triage.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {docs.map((d) => {
                      const selectedDoc = selected?.id === d.id;
                      return (
                        <li key={d.id}>
                          <article
                            className={`rounded-xl border px-2.5 py-2.5 transition duration-200 ${
                              selectedDoc
                                ? "border-[color:color-mix(in_oklch,var(--accent)_40%,var(--line))] bg-[color-mix(in_oklch,var(--surface)_94%,var(--accent)_3%)]"
                                : "border-transparent bg-[var(--surface)] hover:border-[var(--line)] hover:bg-[color-mix(in_oklch,var(--surface)_96%,var(--accent)_2%)]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => loadDetail(d.id)}
                                className="min-w-0 flex-1 cursor-pointer text-left"
                              >
                                <span className="block truncate text-sm font-semibold text-[var(--foreground)]">
                                  {d.original_filename}
                                </span>
                                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--ink-soft)]">
                                  <span>
                                    #{d.id} &middot; {d.page_count ?? "?"}{" "}
                                    pages
                                  </span>
                                  {d.has_video ? (
                                    <span className="inline-flex items-center gap-0.5 rounded-md border border-[color:color-mix(in_oklch,var(--accent)_28%,var(--line))] bg-[color:color-mix(in_oklch,var(--accent)_10%,var(--surface))] px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                                      <VideoGlyph className="h-3 w-3" />
                                      Video
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-0.5 block text-xs text-[var(--ink-soft)]">
                                  {formatUploadedAt(d.uploaded_at)}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(d)}
                                disabled={deletingId === d.id}
                                className="shrink-0 cursor-pointer rounded-md border border-[color:color-mix(in_oklch,var(--danger)_30%,var(--line))] bg-[color:color-mix(in_oklch,var(--danger)_8%,var(--surface))] px-2 py-1 text-xs font-semibold text-[color:color-mix(in_oklch,var(--danger)_70%,var(--foreground))] transition hover:bg-[color:color-mix(in_oklch,var(--danger)_12%,var(--surface))] disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Delete ${d.original_filename}`}
                              >
                                {deletingId === d.id
                                  ? "Deleting..."
                                  : "Remove"}
                              </button>
                            </div>
                          </article>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Detail panel */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
              {!selected ? (
                <div className="flex min-h-[200px] flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-[color-mix(in_oklch,var(--surface)_96%,var(--accent)_2%)] p-8 text-center">
                  <p className="max-w-[36ch] text-sm leading-relaxed text-[var(--ink-soft)]">
                    Select a referral from the queue to see extracted fields and
                    confirm triage readiness.
                  </p>
                </div>
              ) : (
                <article className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-gutter:stable]">
                  {/* Header */}
                  <header className="shrink-0">
                    <h3 className="font-display text-[clamp(1.22rem,2.2vw,2rem)] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
                      {selected.original_filename}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <p className="text-sm text-[var(--ink-soft)]">
                        Referral #{selected.id} &middot;{" "}
                        {selected.page_count ?? "?"} pages &middot;{" "}
                        {formatUploadedAt(selected.uploaded_at)}
                      </p>
                      {selected.parsed_json?.isValid && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[color:color-mix(in_oklch,oklch(0.7_0.2_145)_28%,var(--line))] bg-[color:color-mix(in_oklch,oklch(0.7_0.2_145)_10%,var(--surface))] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[oklch(0.45_0.15_145)]">
                          <CheckGlyph className="h-3 w-3" />
                          Valid
                        </span>
                      )}
                      {selected.has_video ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md border border-[color:color-mix(in_oklch,var(--accent)_28%,var(--line))] bg-[color:color-mix(in_oklch,var(--accent)_10%,var(--surface))] px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                          <VideoGlyph className="h-3 w-3" />
                          Video attached
                        </span>
                      ) : null}
                    </div>
                  </header>

                  {/* ── Extracted fields grid ──────────────────── */}
                  {showFieldGrid ? (
                    <div className="flex flex-col gap-5">
                      {SECTION_ORDER.map((sectionKey) => {
                        const sectionFields = grouped[sectionKey];
                        if (!sectionFields?.length) return null;
                        return (
                          <div key={sectionKey}>
                            <h4 className="mb-3 border-b border-[var(--line)] pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                              {SECTION_LABELS[sectionKey]}
                            </h4>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {sectionFields.map((field) => (
                                <div
                                  key={field.label}
                                  className="rounded-lg border border-[var(--line)] bg-[color-mix(in_oklch,var(--surface)_98%,var(--accent)_1%)] p-3"
                                >
                                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                                    {field.label}
                                  </p>
                                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
                                    {field.value}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Fallback: no structured fields (legacy docs) */
                    <div className="grid shrink-0 gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-[var(--line)] bg-[color-mix(in_oklch,var(--surface)_98%,var(--accent)_1%)] p-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                          Author
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                          {selected.parsed_json?.meta.author ?? "Not detected"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--line)] bg-[color-mix(in_oklch,var(--surface)_98%,var(--accent)_1%)] p-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                          Title
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                          {selected.parsed_json?.meta.title ?? "Not detected"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--line)] bg-[color-mix(in_oklch,var(--surface)_98%,var(--accent)_1%)] p-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                          Subject
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                          {selected.parsed_json?.meta.subject ?? "Not detected"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── AI Analysis ──────────────────────────── */}
                  {showFieldGrid && (
                    <div className="shrink-0">
                      {analysisError && (
                        <div className="mb-3 rounded-xl border border-[color:color-mix(in_oklch,var(--danger)_30%,var(--line))] bg-[color:color-mix(in_oklch,var(--danger)_10%,var(--surface))] px-4 py-3 text-sm text-[color:color-mix(in_oklch,var(--danger)_68%,var(--foreground))]" role="alert">
                          {analysisError}
                        </div>
                      )}

                      {selected.analysis_json ? (
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color:color-mix(in_oklch,oklch(0.65_0.2_280)_14%,var(--surface))] text-[oklch(0.55_0.2_280)]">
                              <AnalysisIcon className="h-4 w-4" />
                            </span>
                            <h4 className="font-display text-lg font-semibold tracking-tight text-[var(--foreground)]">
                              AI Triage Analysis
                            </h4>
                            <button
                              type="button"
                              disabled={analysing}
                              onClick={() => handleAnalyse(selected.id)}
                              className="ml-auto cursor-pointer rounded-lg border border-[color:color-mix(in_oklch,var(--accent)_28%,var(--line))] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[color:color-mix(in_oklch,var(--accent)_8%,var(--surface))] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {analysing ? "Re-analysing..." : "Re-analyse"}
                            </button>
                          </div>

                          {/* Pathway */}
                          <div className="rounded-xl border border-[color:color-mix(in_oklch,oklch(0.7_0.2_145)_25%,var(--line))] bg-[color:color-mix(in_oklch,oklch(0.7_0.2_145)_6%,var(--surface))] p-4">
                            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-[oklch(0.45_0.15_145)]">
                              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path fillRule="evenodd" d="M12.577 4.878a.75.75 0 0 1 .919-.53l4.78 1.281a.75.75 0 0 1 .531.919l-1.281 4.78a.75.75 0 0 1-1.449-.387l.81-3.022a19.407 19.407 0 0 0-5.594 5.203.75.75 0 0 1-1.139.093L7 10.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06l5.25-5.25a.75.75 0 0 1 1.06 0l3.078 3.078a20.923 20.923 0 0 1 5.545-4.93l-3.042.815a.75.75 0 0 1-.534-.455Z" clipRule="evenodd" /></svg>
                              Pathway
                            </h4>
                            {renderMarkdownBlock(selected.analysis_json.pathway)}
                          </div>

                          {/* References */}
                          <details className="group rounded-xl border border-[color:color-mix(in_oklch,oklch(0.65_0.18_250)_25%,var(--line))] bg-[color:color-mix(in_oklch,oklch(0.65_0.18_250)_6%,var(--surface))] [&_summary::-webkit-details-marker]:hidden">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                              <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-[oklch(0.45_0.15_250)]">
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v2.5A2.25 2.25 0 0 0 4.25 9h2.5A2.25 2.25 0 0 0 9 6.75v-2.5A2.25 2.25 0 0 0 6.75 2h-2.5Zm0 9A2.25 2.25 0 0 0 2 13.25v2.5A2.25 2.25 0 0 0 4.25 18h2.5A2.25 2.25 0 0 0 9 15.75v-2.5A2.25 2.25 0 0 0 6.75 11h-2.5Zm9-9A2.25 2.25 0 0 0 11 4.25v2.5A2.25 2.25 0 0 0 13.25 9h2.5A2.25 2.25 0 0 0 18 6.75v-2.5A2.25 2.25 0 0 0 15.75 2h-2.5Zm0 9A2.25 2.25 0 0 0 11 13.25v2.5A2.25 2.25 0 0 0 13.25 18h2.5A2.25 2.25 0 0 0 18 15.75v-2.5A2.25 2.25 0 0 0 15.75 11h-2.5Z" /></svg>
                                References
                              </span>
                              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[var(--ink-soft)] transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                            </summary>
                            <div className="border-t border-[color:color-mix(in_oklch,oklch(0.65_0.18_250)_15%,var(--line))] px-4 pb-4 pt-3">
                              {renderMarkdownBlock(selected.analysis_json.references)}
                            </div>
                          </details>

                          {/* Clinical Reasoning */}
                          <details className="group rounded-xl border border-[color:color-mix(in_oklch,oklch(0.65_0.18_40)_25%,var(--line))] bg-[color:color-mix(in_oklch,oklch(0.65_0.18_40)_6%,var(--surface))] [&_summary::-webkit-details-marker]:hidden">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                              <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-[oklch(0.45_0.15_40)]">
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06a.75.75 0 1 1-1.06 1.06L5.05 4.11a.75.75 0 0 1 0-1.06ZM14.95 3.05a.75.75 0 0 1 0 1.06l-1.06 1.062a.75.75 0 0 1-1.062-1.06l1.06-1.062a.75.75 0 0 1 1.062 0ZM3 8a7 7 0 1 1 11.95 4.95c-.592.591-.98 1.166-1.138 1.538A1.5 1.5 0 0 1 12.44 15.5H7.56a1.5 1.5 0 0 1-1.372-.912c-.158-.372-.546-.947-1.138-1.538A6.97 6.97 0 0 1 3 8Zm4.56 8a.5.5 0 0 0 0 1h4.88a.5.5 0 0 0 0-1H7.56ZM8.5 18a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3Z" /></svg>
                                Clinical Reasoning
                              </span>
                              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[var(--ink-soft)] transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                            </summary>
                            <div className="border-t border-[color:color-mix(in_oklch,oklch(0.65_0.18_40)_15%,var(--line))] px-4 pb-4 pt-3">
                              {renderMarkdownBlock(selected.analysis_json.clinicalReasoning)}
                            </div>
                          </details>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={analysing}
                          onClick={() => handleAnalyse(selected.id)}
                          className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[color:color-mix(in_oklch,oklch(0.65_0.2_280)_30%,var(--line))] bg-[color:color-mix(in_oklch,oklch(0.65_0.2_280)_6%,var(--surface))] px-5 py-6 text-center transition duration-200 hover:border-[oklch(0.55_0.2_280)] hover:bg-[color:color-mix(in_oklch,oklch(0.65_0.2_280)_10%,var(--surface))] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <AnalysisIcon className="h-6 w-6 text-[oklch(0.55_0.2_280)]" />
                          <span className="text-base font-semibold text-[oklch(0.45_0.18_280)]">
                            {analysing ? "Running AI Analysis..." : "Run AI Triage Analysis"}
                          </span>
                          {analysing && (
                            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[oklch(0.55_0.2_280)] border-t-transparent" />
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── Video player ──────────────────────────── */}
                  {selected.has_video ? (
                    <details className="group shrink-0 rounded-xl border border-[var(--line)] bg-[color-mix(in_oklch,var(--surface)_97%,var(--accent)_2%)] [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
                        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:color-mix(in_oklch,var(--accent)_14%,var(--surface))] text-[var(--accent-strong)]">
                            <VideoGlyph className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block">Attached video</span>
                            <span className="mt-0.5 block truncate text-xs font-normal text-[var(--ink-soft)]">
                              {selected.video_original_filename ?? "Clip"}
                            </span>
                          </span>
                        </span>
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5 shrink-0 text-[var(--ink-soft)] transition-transform duration-200 group-open:rotate-180"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </summary>
                      <div className="border-t border-[var(--line)] px-4 pb-4 pt-3 sm:px-5">
                        <video
                          className="aspect-video max-h-[min(70vh,520px)] w-full rounded-lg bg-black object-contain"
                          controls
                          playsInline
                          preload="metadata"
                          src={apiUrl(
                            `/api/documents/${selected.id}/video`
                          )}
                        >
                          Your browser does not support embedded video.
                        </video>
                      </div>
                    </details>
                  ) : null}

                  {/* ── Raw text (collapsible) ────────────────── */}
                  <details className="group shrink-0 rounded-xl border border-[var(--line)] bg-[color-mix(in_oklch,var(--surface)_97%,var(--accent)_2%)] [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        Raw extracted text
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5 shrink-0 text-[var(--ink-soft)] transition-transform duration-200 group-open:rotate-180"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>
                    <div className="border-t border-[var(--line)] px-4 pb-4 pt-3 sm:px-5">
                      <p className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap text-[0.9rem] leading-relaxed text-[var(--foreground)]">
                        {displaySummaryText(selected)}
                      </p>
                    </div>
                  </details>
                </article>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

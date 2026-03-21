"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** When unset, use same-origin `/api/*` (proxied to Express in dev via next.config). */
function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (base) return `${base}${path}`;
  return path;
}

type ParsedJson = {
  numpages: number;
  meta: {
    title: string | null;
    author: string | null;
    subject: string | null;
  };
  fields: Record<string, unknown>;
};

type DocSummary = {
  id: number;
  original_filename: string;
  mime_type: string | null;
  page_count: number | null;
  uploaded_at: string;
  text_excerpt?: string;
  parsed_json?: ParsedJson | null;
  has_video?: boolean;
  video_original_filename?: string | null;
  video_mime_type?: string | null;
};

type DocDetail = DocSummary & { raw_text?: string };

function formatUploadedAt(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * PDF text is often ""; `??` does not treat "" as missing, so we normalize and widen fallbacks.
 * Detail API returns full `raw_text`; `text_excerpt` is only a short list preview (~320 chars) — never prefer it when raw exists.
 */
function displaySummaryText(doc: DocDetail): string {
  const pick = (s: string | null | undefined) => {
    const t = typeof s === "string" ? s.trim() : "";
    return t.length > 0 ? t : "";
  };

  const raw = pick(doc.raw_text);
  if (raw) return raw;

  const excerpt = pick(doc.text_excerpt);
  if (excerpt) return excerpt;

  const subject = pick(doc.parsed_json?.meta.subject);
  if (subject) return subject;

  const title = pick(doc.parsed_json?.meta.title);
  if (title) return title;

  const author = pick(doc.parsed_json?.meta.author);
  if (author) return author;

  return "No extractable body text was found for this PDF. It may be scanned, image-only, or otherwise unreadable to the parser. Use the metadata above and the original file as needed.";
}

const pickerButtonClass =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[color:color-mix(in_oklch,var(--accent)_20%,var(--line))] bg-[var(--surface)] px-6 py-2.5 text-[1.05rem] font-semibold text-[var(--accent-strong)] shadow-[0_8px_22px_color-mix(in_oklch,var(--accent)_10%,transparent)] transition duration-200 ease-out hover:border-[var(--accent)] hover:shadow-[0_10px_24px_color-mix(in_oklch,var(--accent)_14%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

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

export default function Home() {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [selected, setSelected] = useState<DocDetail | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
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
    if (m === "video/mp4" || m === "video/webm" || m === "video/quicktime") {
      return true;
    }
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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setError(null);
    setFile(candidate);
  }

  function selectVideo(candidate: File | null) {
    if (!candidate) {
      setVideoFile(null);
      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
      return;
    }

    if (!file) {
      setError("Select a referral PDF before attaching a video.");
      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
      return;
    }

    if (!isVideo(candidate)) {
      setError("Please choose an MP4, WebM, or MOV file.");
      setVideoFile(null);
      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
      return;
    }

    setError(null);
    setVideoFile(candidate);
  }

  function clearVideo() {
    setVideoFile(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  }

  function clearSelectedFile() {
    setFile(null);
    setVideoFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
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
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (videoFile) {
        fd.append("video", videoFile);
      }
      const r = await fetch(apiUrl("/api/documents"), {
        method: "POST",
        body: fd,
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : `HTTP ${r.status}`
        );
      }
      const doc = body as DocDetail;
      setFile(null);
      setVideoFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
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
      if (selected?.id === doc.id) {
        setSelected(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete document");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="triage-shell min-h-full">
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-6 px-4 py-5 sm:px-7 sm:py-8">
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

        {error ? (
          <div
            className="section-enter delay-1 rounded-xl border border-[color:color-mix(in_oklch,var(--danger)_30%,var(--line))] bg-[color:color-mix(in_oklch,var(--danger)_10%,var(--surface))] px-4 py-3 text-sm text-[color:color-mix(in_oklch,var(--danger)_68%,var(--foreground))]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <section className="section-enter panel delay-2 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[1.55rem] font-semibold tracking-tight text-[var(--foreground)]">
                Upload
              </h2>
              <p className="text-sm text-[var(--ink-soft)]">
                Add a referral file for immediate parsing and preview.
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
                        className="inline-flex min-w-0 max-w-[min(100%,420px)] items-center gap-2 rounded-lg border border-[#d96363] bg-[#e87878] px-2.5 py-2"
                      >
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#dc6666] text-white">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
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
                          ×
                        </button>
                      </div>

                      {videoFile ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex min-w-0 max-w-[min(100%,420px)] items-center gap-2 rounded-lg border border-[color:color-mix(in_oklch,var(--accent)_35%,var(--line))] bg-[color:color-mix(in_oklch,var(--accent)_12%,var(--surface))] px-2.5 py-2"
                        >
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[color:color-mix(in_oklch,var(--accent)_22%,var(--surface))] text-[var(--accent-strong)]">
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                              <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm2 0v8h12V8H6Zm3.5 2.25a.75.75 0 0 1 .45.15l2.75 1.83a.75.75 0 0 1 0 1.24l-2.75 1.83A.75.75 0 0 1 8.5 14.5v-3.5a.75.75 0 0 1 .75-.75Z" />
                            </svg>
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
                            ×
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
                          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
                            <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm2 0v8h12V8H6Zm3.5 2.25a.75.75 0 0 1 .45.15l2.75 1.83a.75.75 0 0 1 0 1.24l-2.75 1.83A.75.75 0 0 1 8.5 14.5v-3.5a.75.75 0 0 1 .75-.75Z" />
                          </svg>
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
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                        <path d="M12 3a6 6 0 0 0-5.915 5H6a5 5 0 0 0 0 10h12a4 4 0 0 0 .65-7.947A6.002 6.002 0 0 0 12 3Zm0 4.5a.75.75 0 0 1 .75.75v4.19l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V8.25A.75.75 0 0 1 12 7.5Z" />
                      </svg>
                    </span>
                    <p className="text-[clamp(1.28rem,1.85vw,1.8rem)] font-semibold tracking-tight text-[var(--foreground)]">
                      Drag and drop referral form
                    </p>
                    <p className="mt-1.5 max-w-[46ch] text-[0.95rem] text-[var(--ink-soft)]">
                      Supports PDF referrals and clinical exports. After you choose a PDF, you can attach an optional MP4, WebM, or MOV clip in the same upload.
                    </p>
                    <p className="mt-4 text-xs font-medium text-[var(--ink-soft)]">
                      No PDF selected
                    </p>
                    <p className="mt-1 max-w-[46ch] text-xs text-[var(--ink-soft)]">
                      Video upload stays disabled until a referral PDF is selected.
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
                        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden="true">
                          <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm2 0v8h12V8H6Zm3.5 2.25a.75.75 0 0 1 .45.15l2.75 1.83a.75.75 0 0 1 0 1.24l-2.75 1.83A.75.75 0 0 1 8.5 14.5v-3.5a.75.75 0 0 1 .75-.75Z" />
                        </svg>
                        Video upload
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </form>
        </section>

        <section className="section-enter panel delay-3 flex min-h-[320px] max-h-[calc(100dvh-10rem)] flex-col overflow-y-auto overscroll-contain md:overflow-hidden">
          <div className="grid min-h-0 flex-1 md:grid-cols-[320px_minmax(0,1fr)]">
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
                  <p className="px-2 py-4 text-sm text-[var(--ink-soft)]">Loading...</p>
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
                                    #{d.id} · {d.page_count ?? "?"} pages
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
                                {deletingId === d.id ? "Deleting..." : "Remove"}
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

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
              {!selected ? (
                <div className="flex min-h-[200px] flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-[color-mix(in_oklch,var(--surface)_96%,var(--accent)_2%)] p-8 text-center">
                  <p className="max-w-[36ch] text-sm leading-relaxed text-[var(--ink-soft)]">
                    Select a referral from the queue to see extracted narrative
                    context and confirm triage readiness.
                  </p>
                </div>
              ) : (
                <article className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
                  <header className="shrink-0">
                    <h3 className="font-display text-[clamp(1.22rem,2.2vw,2rem)] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
                      {selected.original_filename}
                    </h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--ink-soft)]">
                      <span>
                        Referral #{selected.id} · {selected.page_count ?? "?"}{" "}
                        pages · {formatUploadedAt(selected.uploaded_at)}
                      </span>
                      {selected.has_video ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md border border-[color:color-mix(in_oklch,var(--accent)_28%,var(--line))] bg-[color:color-mix(in_oklch,var(--accent)_10%,var(--surface))] px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                          <VideoGlyph className="h-3 w-3" />
                          Video attached
                        </span>
                      ) : null}
                    </p>
                  </header>

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

                  {selected.has_video ? (
                    <details className="group min-h-0 shrink-0 rounded-xl border border-[var(--line)] bg-[color-mix(in_oklch,var(--surface)_97%,var(--accent)_2%)] [&_summary::-webkit-details-marker]:hidden">
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
                          className="aspect-video w-full max-h-[min(70vh,520px)] rounded-lg bg-black object-contain"
                          controls
                          playsInline
                          preload="metadata"
                          src={apiUrl(`/api/documents/${selected.id}/video`)}
                        >
                          Your browser does not support embedded video.
                        </video>
                      </div>
                    </details>
                  ) : null}

                  <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-[var(--line)] bg-[color-mix(in_oklch,var(--surface)_97%,var(--accent)_2%)] p-4 sm:p-5">
                    <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                      Extracted summary
                    </p>
                    <div
                      className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-gutter:stable]"
                      role="region"
                      aria-label="Full extracted document text"
                      tabIndex={0}
                    >
                      <p className="whitespace-pre-wrap text-[0.97rem] leading-relaxed text-[var(--foreground)]">
                        {displaySummaryText(selected)}
                      </p>
                    </div>
                  </section>
                </article>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

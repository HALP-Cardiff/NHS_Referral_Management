"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** When unset, use same-origin `/api/*` (proxied to Express in dev via next.config). */
function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (base) return `${base}${path}`;
  return path;
}

const apiIsCrossOrigin = Boolean(
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
);

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

export default function Home() {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [selected, setSelected] = useState<DocDetail | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function isPdf(candidate: File) {
    return (
      candidate.type === "application/pdf" ||
      candidate.name.toLowerCase().endsWith(".pdf")
    );
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

  function clearSelectedFile() {
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-500">
            Upload PDF (optional video)
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Choose a PDF first. Video (MP4, WebM, or MOV) can be added in the
            same upload and must accompany a PDF.
          </p>
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={handleUpload}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1 text-sm">
                <span className="text-zinc-600">PDF</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-white file:hover:bg-zinc-800"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    if (!f) setVideoFile(null);
                  }}
                />
              </label>
              <button
                type="submit"
                disabled={!file || uploading}
                className="h-10 shrink-0 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition enabled:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Upload and parse"}
              </button>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600">
                Video{" "}
                <span className="font-normal text-zinc-400">
                  (optional, requires PDF above)
                </span>
              </span>
              <input
                id="referral-pdf"
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                disabled={!file || uploading}
                className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-white file:hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
                onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </form>
        </section>

        <section className="section-enter panel delay-3 min-h-[320px] overflow-hidden">
          <div className="grid min-h-[320px] md:grid-cols-[320px_minmax(0,1fr)]">
            <div className="border-b border-[var(--line)] bg-[var(--surface-2)] p-3 md:border-b-0 md:border-r">
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
            </div>
            <div className="flex-1 overflow-auto p-2">
              {listLoading ? (
                <p className="px-2 py-4 text-sm text-zinc-500">Loading…</p>
              ) : docs.length === 0 ? (
                <p className="px-2 py-4 text-sm text-zinc-500">
                  No documents yet. Upload a PDF to get started.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {docs.map((d) => (
                    <li key={d.id}>
                      <div
                        className={`rounded-lg border border-transparent px-2 py-2 transition hover:bg-zinc-50 ${
                          selected?.id === d.id ? "bg-zinc-100" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => loadDetail(d.id)}
                            className="min-w-0 flex-1 text-left text-sm"
                          >
                            <span className="font-medium text-zinc-900">
                              {d.original_filename}
                            </span>
                            <span className="mt-0.5 block text-xs text-zinc-500">
                              #{d.id} · {d.page_count ?? "?"} pages ·{" "}
                              {d.uploaded_at}
                              {d.has_video ? (
                                <span className="ml-1 rounded bg-zinc-200 px-1.5 py-0.5 text-zinc-700">
                                  Video
                                </span>
                              ) : null}
                            </span>
                            {d.text_excerpt ? (
                              <span className="mt-1 line-clamp-2 block text-xs text-zinc-600">
                                {d.text_excerpt}
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(d)}
                            disabled={deletingId === d.id}
                            className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Delete ${d.original_filename}`}
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
                                <span className="mt-1 block text-xs text-[var(--ink-soft)]">
                                  #{d.id} · {d.page_count ?? "?"} pages
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

            <div className="min-h-0 p-4 sm:p-6">
              {!selected ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-[color-mix(in_oklch,var(--surface)_96%,var(--accent)_2%)] p-8 text-center">
                  <p className="max-w-[36ch] text-sm leading-relaxed text-[var(--ink-soft)]">
                    Select a referral from the queue to see extracted narrative
                    context and confirm triage readiness.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Metadata
                    </h3>
                    <dl className="mt-2 grid gap-1 text-sm">
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-zinc-500">Title</dt>
                        <dd>
                          {selected.parsed_json?.meta.title ?? "—"}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-zinc-500">Author</dt>
                        <dd>
                          {selected.parsed_json?.meta.author ?? "—"}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-zinc-500">Pages</dt>
                        <dd>
                          {selected.parsed_json?.numpages ??
                            selected.page_count ??
                            "—"}
                        </dd>
                      </div>
                      {selected.has_video ? (
                        <div className="flex gap-2">
                          <dt className="w-24 shrink-0 text-zinc-500">
                            Video
                          </dt>
                          <dd className="min-w-0 break-all text-zinc-800">
                            {selected.video_original_filename ?? "Attached"}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                  {selected.has_video ? (
                    <div>
                      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Accompanying video
                      </h3>
                      <video
                        key={selected.id}
                        controls
                        crossOrigin={apiIsCrossOrigin ? "anonymous" : undefined}
                        className="mt-2 w-full max-w-full rounded-lg border border-zinc-200 bg-black"
                        src={apiUrl(`/api/documents/${selected.id}/video`)}
                      >
                        Your browser does not support embedded video.
                      </video>
                    </div>
                  ) : null}
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Extracted text
                    </h3>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">
                      Referral #{selected.id} · {selected.page_count ?? "?"} pages · {" "}
                      {formatUploadedAt(selected.uploaded_at)}
                    </p>
                  </header>

                  <div className="grid gap-3 sm:grid-cols-3">
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

                  <section className="rounded-xl border border-[var(--line)] bg-[color-mix(in_oklch,var(--surface)_97%,var(--accent)_2%)] p-4 sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                      Extracted summary
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-[0.97rem] leading-relaxed text-[var(--foreground)]">
                      {selected.text_excerpt ??
                        selected.parsed_json?.meta.subject ??
                        selected.raw_text?.slice(0, 1000) ??
                        "No description available for this document yet."}
                    </p>
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

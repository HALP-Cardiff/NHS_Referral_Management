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
  const [isDragActive, setIsDragActive] = useState(false);
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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
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
                  selectFile(e.dataTransfer.files?.[0] ?? null);
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
                aria-label="Drop PDF here or browse files"
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

                    <button
                      type="submit"
                      disabled={uploading}
                      onClick={(e) => e.stopPropagation()}
                      className="h-12 w-[170px] shrink-0 cursor-pointer rounded-xl border border-transparent bg-[linear-gradient(95deg,color-mix(in_oklch,var(--accent-strong)_96%,black),color-mix(in_oklch,var(--accent)_88%,white))] px-4 text-base font-semibold text-[var(--surface)] shadow-[0_10px_22px_color-mix(in_oklch,var(--accent)_24%,transparent)] transition duration-200 ease-out hover:translate-y-[-1px] hover:shadow-[0_14px_26px_color-mix(in_oklch,var(--accent)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
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
                      Supports PDF referrals and clinical exports. Drop the file in this box to upload.
                    </p>
                    <p className="mt-4 text-xs font-medium text-[var(--ink-soft)]">
                      No PDF selected
                    </p>
                  <span className="mt-4 inline-flex rounded-xl border border-[color:color-mix(in_oklch,var(--accent)_20%,var(--line))] bg-[var(--surface)] px-6 py-2.5 text-[1.05rem] font-semibold text-[var(--accent-strong)] shadow-[0_8px_22px_color-mix(in_oklch,var(--accent)_10%,transparent)]">
                    Browse Files
                  </span>
                  </>
                )}
              </div>
            </div>
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

              <div className="h-[260px] overflow-auto pr-1 md:h-full">
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
                <article className="grid h-full grid-rows-[auto_auto_1fr] gap-4 overflow-auto">
                  <header>
                    <h3 className="font-display text-[clamp(1.22rem,2.2vw,2rem)] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
                      {selected.original_filename}
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

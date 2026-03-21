"use client";

import { useCallback, useEffect, useState } from "react";

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

export default function Home() {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [selected, setSelected] = useState<DocDetail | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
    <div className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">
          NHS Referral Management
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Upload PDF referrals, extract text, and browse stored documents.
        </p>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
        {error ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-500">
            Upload PDF
          </h2>
          <form
            className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={handleUpload}
          >
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-zinc-600">File</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-white file:hover:bg-zinc-800"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="submit"
              disabled={!file || uploading}
              className="h-10 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition enabled:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload and parse"}
            </button>
          </form>
        </section>

        <div className="grid flex-1 gap-6 lg:grid-cols-2">
          <section className="flex min-h-[280px] flex-col rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 className="text-sm font-medium">Documents</h2>
              <button
                type="button"
                onClick={() => loadList()}
                className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline"
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
                            {deletingId === d.id ? "Deleting…" : "Delete PDF"}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="flex min-h-[280px] flex-col rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h2 className="text-sm font-medium">Parsed content</h2>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {!selected ? (
                <p className="text-sm text-zinc-500">
                  Select a document from the list to view extracted metadata
                  and full text.
                </p>
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
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Extracted text
                    </h3>
                    <pre className="mt-2 max-h-[min(420px,50vh)] overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-800">
                      {selected.raw_text?.trim()
                        ? selected.raw_text
                        : "(No text could be extracted — the PDF may be image-only.)"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

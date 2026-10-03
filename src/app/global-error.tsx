"use client";

// ─── Last-resort error boundary ─────────────────────────────────────────────
// Catches a failure in the root layout — in practice the data store, which
// every page depends on. It replaces the whole document, so it cannot rely on
// the app's own components or styles. Its one job beyond saying what happened
// is to let the user take their data out before anything else is tried.

import { useEffect } from "react";

const LS_KEY = "watchkeeper-v1";

function downloadStoredData() {
  const raw = window.localStorage.getItem(LS_KEY);
  if (!raw) return;
  const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `watchkeeper-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const button: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid #334155",
  background: "#1e293b", color: "#e2e8f0", fontSize: 14, cursor: "pointer",
};

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0e14", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 560, margin: "12vh auto", padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>WatchKeeper hit an error</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#94a3b8" }}>
            Nothing has been deleted — your watches and measurements are still saved in
            this browser. Download a copy first, then try again.
          </p>
          <p style={{ fontSize: 12, fontFamily: "monospace", background: "#111827", padding: "8px 12px", borderRadius: 8, color: "#94a3b8" }}>
            {error.message || "Unknown error"}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button style={button} onClick={downloadStoredData}>Download my data</button>
            <button style={button} onClick={() => unstable_retry()}>Try again</button>
          </div>
        </main>
      </body>
    </html>
  );
}

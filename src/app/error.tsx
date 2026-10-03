"use client";

// ─── Page-level error boundary ──────────────────────────────────────────────
// A page that throws shows this instead; the sidebar and the other pages keep
// working, and nothing stored on the device is touched.

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

export default function ErrorPage({
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
    <Card className="max-w-xl p-6">
      <h1 className="text-lg font-bold">This page hit an error</h1>
      <p className="mt-2 text-sm text-muted">
        Your data is untouched — it is still saved on this device. The other pages
        should work as normal.
      </p>
      <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-muted">
        {error.message || "Unknown error"}
      </p>
      <Button className="mt-4" onClick={() => unstable_retry()}>Try again</Button>
    </Card>
  );
}

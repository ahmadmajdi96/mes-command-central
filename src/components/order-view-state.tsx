export function OrderViewError({ message, retry, busy }: { message: string; retry: () => void; busy?: boolean }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/35 bg-destructive/5 p-3 text-sm">
      <p>{message}</p>
      <button type="button" disabled={busy} onClick={retry}
        className="min-h-10 rounded-md border border-border/60 bg-card px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
        {busy ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

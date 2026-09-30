export async function api<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.message ?? body?.error ?? body?.details ?? res.statusText;
    const message =
      typeof err === "string"
        ? err
        : err != null
          ? JSON.stringify(err)
          : "Request failed";
    throw new Error(message);
  }
  return body as T;
}

/** Runs an action per id; one failure doesn't stop the others. */
export async function runAll(
  ids: string[],
  fn: (id: string) => Promise<unknown>,
) {
  const results = await Promise.allSettled(ids.map(fn));
  const failed = results.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  return {
    ok: results.length - failed.length,
    failed: failed.map((f) => f.reason?.message ?? "Failed"),
  };
}

export function summarize(r: { ok: number; failed: string[] }, verb: string) {
  if (r.failed.length === 0)
    return { kind: "success" as const, text: `${r.ok} item(s) ${verb}.` };
  return {
    kind: "error" as const,
    text: `${r.ok} ${verb}, ${r.failed.length} failed: ${[...new Set(r.failed)].join("; ")}`,
  };
}

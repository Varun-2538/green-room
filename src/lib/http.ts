export type JsonResult<T> = { ok: true; body: T } | { ok: false; error: string };

/**
 * Reads an API response in the browser. A platform timeout or crash returns a non-JSON page,
 * which must become a plain message rather than a raw parse error.
 */
export async function readJsonResponse<T = unknown>(response: Response): Promise<JsonResult<T>> {
  const body = (await response.json().catch(() => undefined)) as (T & { error?: unknown }) | undefined;
  if (response.ok && body !== undefined) return { ok: true, body };
  if (body && typeof body.error === "string") return { ok: false, error: body.error };
  if (response.status === 504) return { ok: false, error: "That took too long. Please try again." };
  return { ok: false, error: "Something went wrong. Please try again." };
}

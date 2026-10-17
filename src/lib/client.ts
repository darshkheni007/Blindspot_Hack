/** Small fetch wrapper for client components: throws Error(message) using the API's error shape. */
export class ApiFail extends Error {
  constructor(message: string, readonly fieldErrors?: Record<string, string[]>, readonly status?: number) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init?: Omit<RequestInit, "body"> & { json?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: init?.json !== undefined ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
      body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
  } catch {
    throw new ApiFail("Network problem. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { message?: string; fieldErrors?: Record<string, string[]> };
  if (!res.ok) throw new ApiFail(data.message ?? "Something went wrong. Try again.", data.fieldErrors, res.status);
  return data as T;
}

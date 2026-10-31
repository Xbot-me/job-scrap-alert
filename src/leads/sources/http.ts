const UA = "scrap-jobs-leads/1.0 (personal job search)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with a timeout and a couple of patient retries on rate limits. */
export async function get(url: string, { retries = 2, backoffMs = 8000 } = {}): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (res.ok) return res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await sleep(backoffMs * (attempt + 1));
      continue;
    }
    throw new Error(`${res.status} from ${new URL(url).host}`);
  }
}

export async function getJson<T>(url: string): Promise<T> {
  return JSON.parse(await get(url)) as T;
}

export { sleep };

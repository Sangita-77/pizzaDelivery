import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = { method?: "GET" | "POST" | "PUT" | "DELETE"; json?: unknown };

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const token = await storage.secureGet("auth_token", "");
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as any)?.error || "Something went wrong. Please try again", res.status);
  return body as T;
}

// Menu images live behind the /api ingress route: /api/images/menu/<file>.jpg
export function imageUrl(path?: string | null): string {
  if (!path) return "";
  return `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/images${path}`;
}

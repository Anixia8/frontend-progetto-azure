import { API_BASE_URL } from "../config";

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  headers?: HeadersInit;
};

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

export async function apiFetch<T>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<ApiResult<T>> {
  const { method = "GET", body, headers } = options;

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const raw = await res.text();

    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data?.error || raw || `Errore HTTP ${res.status}`,
      };
    }

    return {
      ok: true,
      status: res.status,
      data,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      error: "Errore di rete o server non raggiungibile",
    };
  }
}

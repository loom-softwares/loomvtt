/*******************************************************************************
 * LoomVTT
 * client/core/api.ts
 * 
 * 
 * API client for interacting with the backend.
 ******************************************************************************/

const BASE = '/api';

export const API_PATHS = {
  SETUP_STATUS: '/setup/status',
  SETUP_INIT: '/setup/init',
  SETUP_LOGIN: '/setup/login',
  SETUP_LOGOUT: '/setup/logout',
  SETUP_VERIFY: '/setup/verify',
  SETUP_CONFIG: '/setup/config',
  SETUP_LOCAL_ADDRESS: '/setup/local-address',
  WORLDS: '/worlds',
  WORLDS_INVITE_LINKS: '/worlds/:id/invite-links',
  WORLDS_REGENERATE_PASSWORD: '/worlds/:id/invite-links/regenerate-password',
  SYSTEMS: '/systems',
  MARKETPLACE: '/marketplace',
} as const;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Internal request wrapper.
 * 
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - API path appended to the base URL
 * @param body - Optional JSON payload
 * @returns The parsed JSON response or null
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = data?.error || data?.message || res.statusText;
    throw new ApiError(res.status, message);
  }

  return data as T;
}

/**
 * REST API Client. Methods automatically include credentials and handle JSON.
 */
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

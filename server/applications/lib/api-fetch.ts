export function authHeaders(session: any): Record<string, string> {
  const h: Record<string, string> = {};
  if (session?.userId) h['x-user-id'] = session.userId;
  if (session?.userRole !== undefined) h['x-user-role'] = String(session.userRole);
  return h;
}

export async function apiFetch(url: string, session: any, options: RequestInit = {}): Promise<Response> {
  const headers = { ...authHeaders(session), ...options.headers as Record<string, string> };
  return fetch(url, { ...options, headers });
}

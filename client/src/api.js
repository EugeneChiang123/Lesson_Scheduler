/**
 * API helper for protected endpoints: adds Clerk Bearer token to requests.
 * Use for /api/event-types (list, get by id, create, patch) and /api/bookings (list, get, patch, delete).
 * For public endpoints (Book page) use plain fetch without this helper.
 */
import { useAuth } from '@clerk/clerk-react';

const API_BASE = '/api';

export function useApi() {
  const { getToken } = useAuth();

  async function apiFetch(path, options = {}) {
    const token = await getToken();
    const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = {
      ...(options.headers || {}),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData) && !(options.body instanceof URLSearchParams)) {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }
    return fetch(url, { ...options, headers });
  }

  return { apiFetch };
}

/**
 * API helper for protected endpoints: adds Clerk Bearer token to requests.
 * Use for /api/event-types (list, get by id, create, patch) and /api/bookings (list, get, patch, delete).
 * For public endpoints (Book page) use plain fetch without this helper.
 */
import { useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

const API_BASE = '/api';

export function useApi() {
  const { getToken } = useAuth();

  const apiFetch = useCallback(async (path, options = {}) => {
    const token = await getToken();
    const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = {
      ...(options.headers || {}),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const body = options.body;
    const isPlainObject =
      body !== undefined &&
      body !== null &&
      typeof body === 'object' &&
      !(body instanceof FormData) &&
      !(body instanceof URLSearchParams);
    const bodyToSend = isPlainObject ? JSON.stringify(body) : body;
    const sendJson = isPlainObject || (body !== undefined && body !== null && typeof body === 'string');
    if (sendJson && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    return fetch(url, { ...options, headers, body: bodyToSend });
  }, [getToken]);

  return { apiFetch };
}

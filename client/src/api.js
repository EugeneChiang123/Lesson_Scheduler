/**
 * API helper for protected endpoints: adds Clerk Bearer token to requests.
 * Use for /api/event-types (list, get by id, create, patch) and /api/bookings (list, get, patch, delete).
 * For public endpoints (Book page) use plain fetch without this helper.
 */
import { useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

// Base URL for API requests.
// - In web builds, leave VITE_API_URL unset to use relative '/api' (works with the dev proxy and same-origin deployments).
// - For native (iOS/Android) builds, set VITE_API_URL to your full API base, e.g. 'https://your-api.example.com/api'.
const RAW_API_BASE = import.meta.env.VITE_API_URL ?? '/api';
export const API_BASE = RAW_API_BASE.replace(/\/+$/, '');

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

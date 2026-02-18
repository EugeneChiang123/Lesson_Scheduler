import { useState, useEffect } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { RESERVED_SLUGS } from '../constants/reservedSlugs';
import { useApi } from '../api';

/**
 * Resolves /:professionalSlug: reserved -> /setup; old slug -> redirect to current; else show dashboard via Outlet.
 * Renders nested routes (InstructorLayout + SetupHome/BookingsCalendar/etc.) when slug is current user's profile slug.
 */
export default function ProfessionalSlugGuard() {
  const { professionalSlug } = useParams();
  const navigate = useNavigate();
  const { apiFetch } = useApi();
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'notfound'

  useEffect(() => {
    const slug = (professionalSlug || '').trim().toLowerCase();
    if (!slug) {
      setStatus('notfound');
      return;
    }
    if (RESERVED_SLUGS.has(slug)) {
      navigate('/setup', { replace: true });
      return;
    }

    let cancelled = false;
    apiFetch('/professionals/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (cancelled) return;
        if (me && me.profileSlug === slug) {
          setStatus('ok');
          return;
        }
        return fetch(`/api/professionals/by-slug/${slug}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (cancelled) return;
            if (data && data.redirectTo) {
              navigate(data.redirectTo, { replace: true });
              return;
            }
            setStatus('notfound');
          });
      })
      .catch(() => {
        if (!cancelled) setStatus('notfound');
      });

    return () => { cancelled = true; };
  }, [professionalSlug, navigate, apiFetch]);

  if (status === 'loading') return <div style={{ padding: 24 }}>Loading…</div>;
  if (status === 'notfound') return <div style={{ padding: 24 }}>Not found</div>;
  if (status === 'ok') return <Outlet />;
  return null;
}

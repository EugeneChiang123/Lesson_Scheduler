/**
 * Base path for dashboard: /setup or /:professionalSlug.
 * Use for nav links so dashboard works at both /setup and /:slug.
 */
export function getBasePath(pathname) {
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment ? `/${segment}` : '/setup';
}

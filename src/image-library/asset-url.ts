/**
 * Resolves a stored image path against the deployment base.
 *
 * Records store app-served files as root-relative paths (`/images/foo.jpg`), which only
 * resolve when the app is served from a domain root. Joining them to Vite's `BASE_URL`
 * lets the same build run under a subpath — a static host, a preview URL — without
 * rewriting the records. Absolute `http(s)` URLs are returned untouched, so a record that
 * still points at an upstream host keeps working.
 */
export function assetUrl(url: string): string {
  if (!url.startsWith('/')) return url;
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}${url}`;
}

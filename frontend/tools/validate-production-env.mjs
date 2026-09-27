const names = [
  'NEXT_PUBLIC_CLOUDS_SOCKET_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
];
for (const name of names) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required at production build time`);
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    /^(localhost|.*\.localhost|127\..*|0\.0\.0\.0|\[?::1\]?)$/i.test(url.hostname) ||
    url.username || url.password || url.search || url.hash || url.pathname !== '/'
  ) {
    throw new Error(`${name} must be a public HTTPS origin without credentials`);
  }
}

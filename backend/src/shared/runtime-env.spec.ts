import { getAllowedOrigins, getRequiredEnv } from './runtime-env';

describe('production environment safety', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('does not use development database defaults in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PGX_CONN_STR;
    expect(() => getRequiredEnv('PGX_CONN_STR')).toThrow();
  });

  it('requires explicit database credentials in development too', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.PGX_CONN_STR;
    expect(() => getRequiredEnv('PGX_CONN_STR')).toThrow();
  });

  it('requires explicit origins in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.APP_WEB_ORIGIN;
    expect(() => getAllowedOrigins()).toThrow();
  });

  it.each(['*', 'https://app.example.com/path', 'http://app.example.com'])(
    'rejects unsafe production origin %s',
    (origin) => {
      process.env.NODE_ENV = 'production';
      process.env.APP_WEB_ORIGIN = origin;
      expect(() => getAllowedOrigins()).toThrow();
    },
  );

  it('accepts explicitly configured HTTPS origins', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_WEB_ORIGIN =
      'https://app.example.com, https://other.example.com';
    expect(getAllowedOrigins()).toEqual([
      'https://app.example.com',
      'https://other.example.com',
    ]);
  });
});

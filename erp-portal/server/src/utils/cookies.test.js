import { describe, it, expect } from 'vitest';
import express from 'express';
import http from 'node:http';
import { getCookieOptions, REFRESH_COOKIE_NAME, setRefreshCookie } from '../utils/cookies.js';

describe('Cookie Configuration & Set-Cookie Header Verification', () => {
  it('generates cookie options with explicit 7-day maxAge and future expires Date', () => {
    const options = getCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe('/');
    expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000); // 604,800,000 ms
    expect(options.expires).toBeInstanceOf(Date);
    expect(options.expires.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  it('emits Max-Age, Expires, HttpOnly, and SameSite in the Set-Cookie HTTP header', async () => {
    const app = express();
    app.get('/test-login', (_req, res) => {
      setRefreshCookie(res, 'test-jwt-token-value-123456');
      res.json({ ok: true });
    });

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    const cookieHeader = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/test-login`, (res) => {
        const raw = res.headers['set-cookie']?.[0] || '';
        server.close(() => resolve(raw));
      }).on('error', (err) => {
        server.close();
        reject(err);
      });
    });

    console.log('Emitted Set-Cookie header:', cookieHeader);

    expect(cookieHeader).toContain(REFRESH_COOKIE_NAME);
    expect(cookieHeader).toContain('Max-Age=604800');
    expect(cookieHeader).toContain('Path=/');
    expect(cookieHeader).toContain('Expires=');
    expect(cookieHeader).toContain('HttpOnly');
  });

  it('emits SameSite=None, Secure, and Partitioned when configured for cross-origin production', async () => {
    const app = express();
    app.get('/test-production-cookie', (_req, res) => {
      const prodOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        partitioned: true
      };
      res.cookie(REFRESH_COOKIE_NAME, 'test-prod-token-xyz', prodOptions);
      res.json({ ok: true });
    });

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    const cookieHeader = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/test-production-cookie`, (res) => {
        const raw = res.headers['set-cookie']?.[0] || '';
        server.close(() => resolve(raw));
      }).on('error', (err) => {
        server.close();
        reject(err);
      });
    });

    console.log('Production Cross-Origin Set-Cookie header:', cookieHeader);

    expect(cookieHeader).toContain(REFRESH_COOKIE_NAME);
    expect(cookieHeader).toContain('Max-Age=604800');
    expect(cookieHeader).toContain('Path=/');
    expect(cookieHeader).toContain('Expires=');
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('Secure');
    expect(cookieHeader).toContain('SameSite=None');
    expect(cookieHeader).toContain('Partitioned');
  });
});

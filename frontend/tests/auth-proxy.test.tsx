import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { GET as me } from "../app/api/auth/me/route";
import { POST as login } from "../app/api/auth/login/route";

const bridge = "http://backend:3001";
const cookie = "cc_session=synthetic-session";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CLOUDS_BRIDGE_URL;
});

describe("authentication proxy", () => {
  it("passes the browser cookie to Nest and preserves its login Set-Cookie", async () => {
    process.env.CLOUDS_BRIDGE_URL = bridge;
    const setCookie = `${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax`;
    const backendFetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { "content-type": "application/json", "set-cookie": setCookie },
    })).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, user: { id: "u1" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", backendFetch);

    const loginResponse = await login(new Request("https://cloudscommunity.com.br/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "example", password: "synthetic" }),
    }));
    expect(loginResponse.status).toBe(201);
    expect(loginResponse.headers.get("set-cookie")).toBe(setCookie);

    const meResponse = await me(new Request("https://cloudscommunity.com.br/api/auth/me", {
      headers: { cookie },
    }));
    expect(meResponse.status).toBe(200);
    expect(backendFetch.mock.calls[1][0]).toBe(`${bridge}/auth/me`);
    expect(new Headers(backendFetch.mock.calls[1][1].headers).get("cookie")).toBe(cookie);
  });

  it("validates a protected page against Nest without clearing a valid cookie", async () => {
    process.env.CLOUDS_BRIDGE_URL = bridge;
    const backendFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", backendFetch);

    const response = await proxy(new NextRequest("https://cloudscommunity.com.br/", { headers: { cookie } }));
    expect(backendFetch.mock.calls[0][0].toString()).toBe(`${bridge}/auth/session`);
    expect(backendFetch.mock.calls[0][1].headers.cookie).toBe(cookie);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("only clears a session after Nest confirms it is unauthorized", async () => {
    process.env.CLOUDS_BRIDGE_URL = bridge;
    const backendFetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", backendFetch);

    const request = new NextRequest("https://cloudscommunity.com.br/", { headers: { cookie } });
    const unavailable = await proxy(request);
    expect(unavailable.status).toBe(200);
    expect(unavailable.headers.get("set-cookie")).toBeNull();

    const unauthorized = await proxy(request);
    expect(unauthorized.status).toBe(307);
    expect(unauthorized.headers.get("location")).toBe("https://cloudscommunity.com.br/login");
    expect(unauthorized.headers.get("set-cookie")).toContain("cc_session=");
  });
});

import { proxyJsonRequest } from "../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return proxyJsonRequest(req, `/auth/me${url.search}`);
}


import { proxyRequest } from "../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return proxyRequest(req, `/auth/verify-email?token=${encodeURIComponent(token)}`);
}

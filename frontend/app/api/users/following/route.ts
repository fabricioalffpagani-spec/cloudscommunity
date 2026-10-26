import { proxyJsonRequest } from "../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const compact = new URL(req.url).searchParams.get("compact");
  return proxyJsonRequest(req, compact === "1" ? "/users/following?compact=1" : "/users/following");
}

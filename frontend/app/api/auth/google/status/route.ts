import { proxyRequest } from "../../../_lib/nest-proxy";

export const runtime = "nodejs";
export async function GET(req: Request) {
  return proxyRequest(req, "/auth/google/status");
}

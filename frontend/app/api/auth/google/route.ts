import { proxyRequest } from "../../_lib/nest-proxy";

export const runtime = "nodejs";
export async function DELETE(req: Request) {
  return proxyRequest(req, "/auth/google");
}

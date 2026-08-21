import { proxyJsonRequest } from "../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return proxyJsonRequest(req, `/clouds/invite/${encodeURIComponent(token)}`);
}

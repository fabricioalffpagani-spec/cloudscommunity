import { proxyJsonRequest } from "../../../../_lib/nest-proxy";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  return proxyJsonRequest(req, `/clouds/${encodeURIComponent(id)}/archive/messages${url.search}`);
}

import { proxyJsonRequest } from "../../../_lib/nest-proxy";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyJsonRequest(req, `/clouds/${encodeURIComponent(id)}/preview`);
}

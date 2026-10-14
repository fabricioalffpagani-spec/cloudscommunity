import { proxyJsonRequest } from "../../../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const { id, messageId } = await params;
  return proxyJsonRequest(req, `/clouds/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/views`);
}

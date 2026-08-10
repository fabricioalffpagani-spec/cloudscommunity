import { proxyJsonRequest } from "../../../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id, messageId } = await params;
  console.log("Unpin request:", { id, messageId, path: `/clouds/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/unpin` });
  return proxyJsonRequest(req, `/clouds/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/unpin`);
}

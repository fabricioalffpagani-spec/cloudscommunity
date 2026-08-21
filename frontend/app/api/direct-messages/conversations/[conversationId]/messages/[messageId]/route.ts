import { proxyJsonRequest } from "../../../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  const { conversationId, messageId } = await params;
  return proxyJsonRequest(
    req,
    `/direct-messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
  );
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  const { conversationId, messageId } = await params;
  return proxyJsonRequest(
    req,
    `/direct-messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
  );
}

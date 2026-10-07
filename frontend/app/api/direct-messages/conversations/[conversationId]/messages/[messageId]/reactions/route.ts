import { proxyJsonRequest } from "../../../../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  const { conversationId, messageId } = await params;
  try {
    return await proxyJsonRequest(
      req,
      `/direct-messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/reactions`,
    );
  } catch {
    return Response.json(
      { ok: false, message: "O serviço de mensagens está indisponível no momento." },
      { status: 503 },
    );
  }
}

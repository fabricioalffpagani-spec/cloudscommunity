import { proxyJsonRequest } from "../../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  return proxyJsonRequest(
    req,
    `/direct-messages/conversations/${encodeURIComponent(conversationId)}/read`,
  );
}

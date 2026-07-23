import { proxyJsonRequest } from "../../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const resolvedParams = await params;
  const url = new URL(req.url);
  return proxyJsonRequest(
    req,
    `/direct-messages/conversations/${encodeURIComponent(resolvedParams.conversationId)}/messages${url.search}`,
  );
}

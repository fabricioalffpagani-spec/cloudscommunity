import { proxyRequest } from "../../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const resolvedParams = await params;
  return proxyRequest(
    req,
    `/direct-messages/conversations/${encodeURIComponent(resolvedParams.conversationId)}/audio`,
  );
}

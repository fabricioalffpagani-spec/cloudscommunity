import { proxyJsonRequest } from "../../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ identifier: string; followerId: string }> }) {
  const { identifier, followerId } = await context.params;
  return proxyJsonRequest(request, `/users/${encodeURIComponent(identifier)}/followers/${encodeURIComponent(followerId)}`);
}

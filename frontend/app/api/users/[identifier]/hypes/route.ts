import { proxyJsonRequest } from "../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ identifier: string }> }) {
  const { identifier } = await context.params;
  return proxyJsonRequest(request, `/users/${encodeURIComponent(identifier)}/hypes`);
}

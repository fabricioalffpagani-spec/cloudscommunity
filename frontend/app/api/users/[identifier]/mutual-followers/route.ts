import { proxyJsonRequest } from "../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function GET(req: Request, context: { params: Promise<{ identifier: string }> }) {
  const { identifier } = await context.params;
  return proxyJsonRequest(req, `/users/${encodeURIComponent(identifier)}/mutual-followers`);
}

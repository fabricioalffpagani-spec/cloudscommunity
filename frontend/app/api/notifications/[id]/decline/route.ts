import { proxyJsonRequest } from "../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  return proxyJsonRequest(req, `/notifications/${encodeURIComponent(params.id)}/decline`);
}

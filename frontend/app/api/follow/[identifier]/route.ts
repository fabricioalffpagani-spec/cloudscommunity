import { proxyJsonRequest } from "../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  context: { params: Promise<{ identifier: string }> },
) {
  const params = await context.params;
  return proxyJsonRequest(req, `/users/${encodeURIComponent(params.identifier)}/follow`);
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ identifier: string }> },
) {
  const params = await context.params;
  return proxyJsonRequest(req, `/users/${encodeURIComponent(params.identifier)}/follow`);
}

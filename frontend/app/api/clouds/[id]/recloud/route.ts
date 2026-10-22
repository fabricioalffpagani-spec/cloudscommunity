import { proxyJsonRequest } from "../../../_lib/nest-proxy";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
async function forward(req: Request, { params }: Context) {
  const { id } = await params;
  return proxyJsonRequest(req, `/clouds/${encodeURIComponent(id)}/recloud`);
}
export const GET = forward;
export const POST = forward;
export const DELETE = forward;

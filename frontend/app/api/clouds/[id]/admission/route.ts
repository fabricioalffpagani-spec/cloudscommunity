import { proxyJsonRequest } from "../../../_lib/nest-proxy";

export const runtime = "nodejs";
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyJsonRequest(req, `/clouds/${encodeURIComponent(id)}/admission`);
}

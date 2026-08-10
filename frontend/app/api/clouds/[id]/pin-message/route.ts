import { proxyJsonRequest } from "../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  console.log("Pin request:", { id, path: `/clouds/${encodeURIComponent(id)}/pin-message` });
  return proxyJsonRequest(req, `/clouds/${encodeURIComponent(id)}/pin-message`);
}

import { proxyJsonRequest } from "../../../../_lib/nest-proxy";

export const runtime = "nodejs";

// Reactions share this dynamic message route. Keeping this handler here avoids
// a nested dynamic route that Next does not register beneath `route.ts`.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id, messageId } = await params;
  return proxyJsonRequest(
    req,
    `/clouds/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/reactions`,
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id, messageId } = await params;
  return proxyJsonRequest(
    req,
    `/clouds/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`,
  );
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id, messageId } = await params;
  return proxyJsonRequest(
    req,
    `/clouds/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`,
  );
}

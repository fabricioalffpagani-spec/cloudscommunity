import { proxyJsonRequest } from "../_lib/nest-proxy";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return proxyJsonRequest(req, "/clouds");
}

export async function POST(req: Request) {
  return proxyJsonRequest(req, "/clouds");
}

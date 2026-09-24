import { proxyJsonRequest } from "../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return proxyJsonRequest(req, "/users/search-history");
}

export async function POST(req: Request) {
  return proxyJsonRequest(req, "/users/search-history");
}

export async function DELETE(req: Request) {
  return proxyJsonRequest(req, "/users/search-history");
}

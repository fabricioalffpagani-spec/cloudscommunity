import { NextRequest } from 'next/server';
import { proxyJsonRequest } from '../../../_lib/nest-proxy';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await context.params;
  return proxyJsonRequest(request, `/users/${identifier}/followers`);
}

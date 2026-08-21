import { NextRequest, NextResponse } from 'next/server';
import { nestProxy } from '../../_lib/nest-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: { identifier: string } }
) {
  return nestProxy(request, `/users/${params.identifier}/followers`);
}
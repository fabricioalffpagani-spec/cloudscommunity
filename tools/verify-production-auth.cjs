// Feed to `docker compose exec -T -e DEPLOYMENT_TEST_ONLY=1 backend node` on TEST volumes only.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, scryptSync } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const WebSocket = require('ws'); // Runtime dependency of the Socket.IO transport.
if (process.env.DEPLOYMENT_TEST_ONLY !== '1') throw new Error('Use an isolated test stack only');
const db = new PrismaClient({ adapter: new PrismaPg(process.env.PGX_CONN_STR) });
const id = randomUUID();
const peerId = randomUUID();
const email = `deployment-${id}@example.invalid`;
const password = randomBytes(24).toString('base64url');
const salt = randomBytes(16).toString('hex');
const origin = process.env.APP_WEB_ORIGIN.split(',')[0].trim();
const api = process.env.DEPLOYMENT_TEST_BACKEND_URL || 'http://127.0.0.1:3001';
const frontend = process.env.DEPLOYMENT_TEST_FRONTEND_URL || 'http://frontend:3000';
let sid;
let cookie;
async function verifyWebSocket() {
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`${api.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`, {
      headers: { cookie, Origin: origin },
    });
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      if (error) reject(error); else resolve();
    };
    const timeout = setTimeout(() => finish(new Error('Authenticated WebSocket timed out')), 10000);
    const probe = () => {
      if (socket.readyState === WebSocket.OPEN && !settled) {
        socket.send('42/direct-messages,1["conversation:join",{}]');
      }
    };
    socket.on('message', (data) => {
      const packet = data.toString();
      if (packet === '2') socket.send('3');
      else if (packet.startsWith('0')) socket.send('40/direct-messages,');
      else if (packet.startsWith('40/direct-messages,')) probe();
      else if (packet.startsWith('43/direct-messages,1')) {
        const [ack] = JSON.parse(packet.slice(packet.indexOf('[')));
        // This response can only come from the authenticated branch of the handler.
        if (ack.message === 'Informe a conversa.') finish();
        else setTimeout(probe, 100);
      }
    });
    socket.on('error', finish);
    socket.on('close', () => finish(new Error('WebSocket closed before authentication')));
  });
}
async function run() {
  try {
    await db.user.create({ data: {
      id, email, passwordHash: `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`,
      status: 'active', emailVerifiedAt: new Date(),
      profile: { create: {
        username: `dep${id.replaceAll('-', '').slice(0, 12)}`,
        displayName: 'Deployment fixture', birthDate: new Date('1990-01-01'),
      } },
    } });
    const login = await fetch(`${frontend}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: email, password }),
    });
    assert.equal(login.status, 201);
    const setCookie = login.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/i);
    if (process.env.NODE_ENV === 'production') assert.match(setCookie, /Secure/i);
    else assert.doesNotMatch(setCookie, /;\s*Secure/i);
    assert.match(setCookie, /SameSite=Lax/i);
    const domain = process.env.SESSION_COOKIE_DOMAIN?.trim();
    if (domain) assert.ok(setCookie.includes(`Domain=${domain}`));
    cookie = setCookie.split(';')[0];
    assert.equal((await fetch(`${frontend}/api/auth/session`, { headers: { cookie } })).status, 200);
    const headers = { cookie, Origin: origin };
    const handshake = await fetch(`${api}/socket.io/?EIO=4&transport=polling`, { headers });
    assert.equal(handshake.status, 200);
    sid = JSON.parse((await handshake.text()).slice(1)).sid;
    const transport = `${api}/socket.io/?EIO=4&transport=polling&sid=${sid}`;
    const connect = await fetch(transport, {
      method: 'POST', headers: { ...headers, 'content-type': 'text/plain' },
      body: '40/direct-messages,',
    });
    assert.equal(connect.status, 200);
    const packets = await fetch(transport, { headers, signal: AbortSignal.timeout(10000) }).then(r => r.text());
    assert.ok(packets.includes('40/direct-messages,'), `Socket.IO auth failed: ${packets}`);
    // Closing the transport exercises Redis presence decrement/disconnect as well.
    await fetch(transport, { method: 'POST', headers: { ...headers, 'content-type': 'text/plain' }, body: '1' });
    sid = null;
    await verifyWebSocket();
    await db.user.create({ data: {
      id: peerId, email: `deployment-${peerId}@example.invalid`, passwordHash: 'test-peer-no-login',
      status: 'active', emailVerifiedAt: new Date(),
      profile: { create: { username: `dep${peerId.replaceAll('-', '').slice(0, 12)}`,
        displayName: 'Upload fixture peer', birthDate: new Date('1990-01-01') } },
    } });
    const conversationResponse = await fetch(`${frontend}/api/direct-messages/conversations`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ peerUserId: peerId }),
    });
    assert.equal(conversationResponse.status, 201);
    const conversation = (await conversationResponse.json()).conversation;
    const uploadUrl = `${frontend}/api/direct-messages/conversations/${conversation.id}/image`;
    const nestedForm = new FormData();
    nestedForm.set('metadata[999999999]', 'invalid nested field');
    assert.equal((await fetch(uploadUrl, { method: 'POST', headers: { cookie }, body: nestedForm })).status, 400);
    const invalidForm = new FormData();
    invalidForm.set('file', new Blob(['invalid image'], { type: 'text/plain' }), 'fixture.txt');
    assert.equal((await fetch(uploadUrl, { method: 'POST', headers: { cookie }, body: invalidForm })).status, 400);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7V0AAAAASUVORK5CYII=', 'base64');
    const validForm = new FormData();
    validForm.set('file', new Blob([png], { type: 'image/png' }), 'fixture.png');
    const upload = await fetch(uploadUrl, { method: 'POST', headers: { cookie }, body: validForm });
    assert.equal(upload.status, 201);
    const uploaded = await upload.json();
    assert.equal(uploaded.message.type, 'image');
    assert.equal(uploaded.message.mediaAsset.mimeType, 'image/png');
    assert.equal(uploaded.message.mediaAsset.sizeBytes, String(png.length));
    const logout = await fetch(`${frontend}/api/auth/logout`, { method: 'POST', headers: { cookie } });
    assert.equal(logout.status, 201);
    if (domain) assert.ok(logout.headers.get('set-cookie').includes(`Domain=${domain}`));
    assert.equal((await fetch(`${frontend}/api/auth/session`, { headers: { cookie } })).status, 401);
    console.log(`PASS ${process.env.NODE_ENV} login, environment-specific cookies/domain, BFF session, authenticated Socket.IO polling/WebSocket, Multer multipart uploads and logout`);
  } finally {
    if (sid) {
      await fetch(`${api}/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
        method: 'POST', headers: { cookie, Origin: origin, 'content-type': 'text/plain' }, body: '1',
      }).catch(() => {});
    }
    await db.user.deleteMany({ where: { id: { in: [id, peerId] } } });
    await db.$disconnect();
  }
}
run().catch(e => { console.error(e.message); process.exitCode = 1; });

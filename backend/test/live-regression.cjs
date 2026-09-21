// Run against the local Compose stack: node test/live-regression.cjs
// Fixtures use random identities and are removed in finally, including failures.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, scryptSync } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const connection = process.env.PGX_CONN_STR;
if (!connection || !['postgres', 'localhost', '127.0.0.1'].includes(new URL(connection).hostname)) {
  throw new Error('Live regression is restricted to a local PostgreSQL instance.');
}
const prisma = new PrismaClient({ adapter: new PrismaPg(connection) });
const backend = `http://127.0.0.1:${process.env.APP_HTTP_PORT || 3001}`;
const frontend = process.env.REGRESSION_FRONTEND_URL || 'http://frontend:3000';
const userIds = [];
let checks = 0;

async function request(path, { origin = backend, cookie, method = 'GET', body, status = 200 } = {}) {
  const response = await fetch(origin + path, {
    method, redirect: 'manual', signal: AbortSignal.timeout(90000),
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${path}: expected ${status}, got ${response.status}: ${text.slice(0, 250)}`);
  return { response, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text };
}
function pass(name) { checks++; console.log(`PASS ${name}`); }

async function fixtureUser() {
  const id = randomUUID();
  const email = `regression-${id}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  await prisma.user.create({ data: {
    id, email, passwordHash: `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`,
    status: 'active', emailVerifiedAt: new Date(),
    profile: { create: { username: `reg${id.replaceAll('-', '').slice(0, 16)}`, displayName: 'Regression Fixture', birthDate: new Date('1990-01-01') } },
  } });
  userIds.push(id);
  const login = await request('/api/auth/login', { origin: frontend, method: 'POST', body: { identifier: email, password }, status: 201 });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('cc_session='));
  assert.equal(login.body.user.id, id);
  if (process.env.NODE_ENV === 'production') assert.match(login.response.headers.get('set-cookie'), /secure/i);
  return { id, cookie };
}

async function run() {
  try {
    assert.equal((await request('/health')).body.healthy, true);
    pass('PostgreSQL and Redis health');
    const author = await fixtureUser();
    const reader = await fixtureUser();
    pass('Login via frontend proxy and session cookies');
    await request('/clouds/read', { status: 401 });
    await request('/api/clouds/read', { origin: frontend, status: 401 });
    pass('Read requires authentication on backend and frontend');

    const create = async (visibility = 'public') => (await request('/api/clouds', { origin: frontend, cookie: author.cookie, method: 'POST', status: 201, body: { title: 'Regression cloud', duration: '10min', visibility } })).body.cloud;
    const archived = await create();
    const active = await create();
    const privateCloud = await create('private');
    await request(`/clouds/${archived.id}/join`, { cookie: reader.cookie, method: 'POST', status: 201 });
    const sent = [];
    for (let i = 1; i <= 15; i++) {
      sent.push((await request(`/api/clouds/${archived.id}/messages`, { origin: frontend, cookie: author.cookie, method: 'POST', status: 201, body: { type: 'text', content: `Regression message ${i}` } })).body.message.id);
    }
    pass('Create, join and send 15 messages through live API');
    await prisma.cloud.updateMany({ where: { id: { in: [archived.id, privateCloud.id] } }, data: { startedAt: new Date(Date.now() - 660000) } });
    const talk = (await request('/api/clouds', { origin: frontend, cookie: reader.cookie })).body.clouds;
    assert.ok(talk.some(cloud => cloud.id === active.id));
    assert.ok(!talk.some(cloud => cloud.id === archived.id));
    const read = (await request('/api/clouds/read', { origin: frontend, cookie: reader.cookie })).body.clouds;
    assert.ok(read.some(cloud => cloud.id === archived.id && cloud.messagesCount === 15));
    assert.ok(!read.some(cloud => [active.id, privateCloud.id].includes(cloud.id)));
    pass('Automatic expiration moves public clouds from Talk to Read');

    const preview = (await request(`/api/clouds/${archived.id}/preview?take=100`, { origin: frontend, cookie: reader.cookie })).body;
    assert.equal(preview.messages.length, 10);
    assert.deepEqual(preview.messages.map(message => message.id), sent.slice(0, 10));
    const completeArchive = (await request(`/api/clouds/${archived.id}/archive/messages?take=100`, { origin: frontend, cookie: reader.cookie })).body;
    const archivedUserMessages = completeArchive.messages.filter(message => message.type !== 'system');
    assert.equal(archivedUserMessages.length, 15);
    assert.deepEqual(archivedUserMessages.map(message => message.id), sent);
    const ownerClouds = (await request('/api/clouds/mine', { origin: frontend, cookie: author.cookie })).body.clouds;
    assert.ok(ownerClouds.some(cloud => cloud.id === archived.id && cloud.status === 'ended'));
    await request(`/clouds/${active.id}/preview`, { cookie: reader.cookie, status: 404 });
    await request(`/clouds/${privateCloud.id}/preview`, { cookie: reader.cookie, status: 404 });
    pass('Preview returns 10 messages, full archive returns all messages, and profile includes the ended cloud');

    for (const [method, suffix, body] of [
      ['POST', '/join'], ['POST', '/messages', { type: 'text', content: 'must fail' }],
      ['PATCH', `/messages/${sent[0]}`, { content: 'must fail' }], ['DELETE', `/messages/${sent[0]}`],
      ['PATCH', `/messages/${sent[0]}/pin`], ['PATCH', `/messages/${sent[0]}/unpin`],
      ['POST', `/messages/${sent[0]}/reactions`, { emoji: '👍' }],
    ]) await request(`/clouds/${archived.id}${suffix}`, { cookie: author.cookie, method, body, status: 400 });
    assert.equal(await prisma.cloudMessage.count({ where: { cloudId: archived.id, type: { not: 'system' }, deletedAt: null } }), 15);
    pass('Ended clouds reject joins, messages, edits, deletions, pins and reactions');

    await prisma.profile.update({ where: { userId: author.id }, data: { isPrivate: true } });
    await request(`/clouds/${archived.id}/preview`, { cookie: reader.cookie, status: 404 });
    await prisma.follow.create({ data: { followerId: reader.id, followingId: author.id } });
    await request(`/clouds/${archived.id}/preview`, { cookie: reader.cookie });
    await prisma.userBlock.create({ data: { blockerId: author.id, blockedId: reader.id } });
    await request(`/clouds/${archived.id}/preview`, { cookie: reader.cookie, status: 404 });
    assert.ok(!(await request('/clouds/read', { cookie: reader.cookie })).body.clouds.some(cloud => cloud.id === archived.id));
    await prisma.userBlock.delete({ where: { blockerId_blockedId: { blockerId: author.id, blockedId: reader.id } } });
    await prisma.cloudBan.create({ data: { cloudId: archived.id, userId: reader.id, bannedById: author.id } });
    await request(`/clouds/${archived.id}/preview`, { cookie: reader.cookie, status: 404 });
    pass('Private profiles, follows, blocks and bans protect archived conversations');

    const conversation = (await request('/direct-messages/conversations', { cookie: author.cookie, method: 'POST', status: 201, body: { peerUserId: reader.id } })).body.conversation;
    await request(`/direct-messages/conversations/${conversation.id}/messages`, { cookie: author.cookie, method: 'POST', status: 201, body: { content: 'Regression direct message' } });
    const history = (await request(`/direct-messages/conversations/${conversation.id}/messages`, { cookie: reader.cookie })).body.messages;
    assert.ok(history.some(message => message.content === 'Regression direct message'));
    pass('Direct messages still send and load correctly');

    for (const path of ['/', '/read', '/meet', '/messages', '/profile', '/settings', '/trending', `/cloud/${archived.id}/preview`, `/cloud/${archived.id}/conversation`]) {
      const page = await request(path, { origin: frontend, cookie: author.cookie });
      assert.match(page.body, /<!DOCTYPE html>/i);
    }
    const legacy = await request('/following', { origin: frontend, cookie: author.cookie, status: 307 });
    assert.equal(legacy.response.headers.get('location'), '/read');
    const anonymous = await request('/read', { origin: frontend, status: 307 });
    assert.match(anonymous.response.headers.get('location'), /\/login$/);
    pass('Frontend routes, legacy redirect and authentication protection');
    await request('/api/auth/logout', { origin: frontend, cookie: author.cookie, method: 'POST', status: 201 });
    await request('/clouds/read', { cookie: author.cookie, status: 401 });
    pass('Logout revokes access');
    console.log(`LIVE REGRESSION: ${checks} groups passed`);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    console.log('Removed only the fixture users created by this run and their cascading data.');
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });

// Run only against an isolated production test stack. Never creates/deletes data.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const compose = ['compose', '--env-file', process.env.VERIFY_ENV_FILE || '/dev/null', '-f', 'docker-compose.prod.yml'];
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const config = JSON.parse(docker(...compose, 'config', '--format', 'json'));
for (const [name, service] of Object.entries(config.services)) {
  assert.ok(!service.build, `${name} must never build on the VM`);
  assert.ok(!(service.volumes || []).some(v => v.type === 'bind'), `${name}: source bind mount`);
  assert.equal(service.restart, 'unless-stopped');
  const id = docker(...compose, 'ps', '-q', name);
  assert.ok(id, `${name} must be running`);
  const state = JSON.parse(docker('inspect', '--format', '{{json .State}}', id));
  assert.equal(state.Health?.Status, 'healthy', `${name} health`);
  if (['postgres', 'redis'].includes(name)) assert.ok(!service.ports?.length, `${name}: public ports`);
  else {
    assert.ok(service.ports.every(p => p.host_ip === '127.0.0.1'));
    assert.equal(service.environment.NODE_ENV, 'production');
    assert.ok(!service.environment.WATCHPACK_POLLING && !service.environment.CHOKIDAR_USEPOLLING);
    assert.ok(!service.environment.TSC_WATCHFILE && !service.environment.TSC_WATCHDIRECTORY);
    const image = JSON.parse(docker('image', 'inspect', '--format', '{{json .}}', service.image));
    assert.equal(image.Architecture, 'amd64');
    assert.equal(image.Os, 'linux');
    assert.equal(image.Config.User, 'node');
    assert.ok(!image.Config.Env.some(e => /^(PGX_CONN_STR|PGX_ADMIN_PASS|RESEND_API_KEY)=/.test(e)));
  }
}
docker(...compose, 'exec', '-T', 'redis', 'redis-cli', 'ping');
const script = `
const assert = require('node:assert/strict');
(async () => {
  const health = await fetch('http://backend:3001/health').then(r => r.json());
  assert.equal(health.healthy, true);
  const login = await fetch('http://127.0.0.1:3000/login');
  assert.equal(login.status, 200);
  const session = await fetch('http://127.0.0.1:3000/api/auth/session');
  assert.equal(session.status, 401);
  const allowed = ${JSON.stringify(config.services.backend.environment.APP_WEB_ORIGIN.split(',')[0].trim())};
  const cors = await fetch('http://backend:3001/health', {headers: {Origin: allowed}});
  assert.equal(cors.headers.get('access-control-allow-origin'), allowed);
  const forbidden = await fetch('http://backend:3001/socket.io/?EIO=4&transport=polling', {headers: {Origin: 'https://untrusted.invalid'}});
  assert.equal(forbidden.status, 403);
  const socket = await fetch('http://backend:3001/socket.io/?EIO=4&transport=polling', {headers: {Origin: allowed}});
  assert.equal(socket.status, 200);
  assert.match(await socket.text(), /^0/);
  console.log('PASS production health, BFF, Redis, PostgreSQL, CORS and Socket.IO handshake');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
`;
process.stdout.write(docker(...compose, 'exec', '-T', 'frontend', 'node', '-e', script) + '\n');
console.log('PASS production Compose isolation and healthchecks');

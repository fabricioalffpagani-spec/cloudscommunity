#!/usr/bin/env bash
set -euo pipefail

sha="${1:?Expected the published commit SHA}"
repository="${2:?Expected the GHCR repository}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid deployment SHA' >&2; exit 1; }
[[ "$repository" =~ ^[a-z0-9._-]+/[a-z0-9._-]+$ ]] || { echo 'Invalid GHCR repository' >&2; exit 1; }

cd /opt/clouds
[[ "$(git branch --show-current)" == main ]] || { echo 'Oracle checkout is not on main' >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Oracle checkout has local changes; deployment aborted' >&2; exit 1; }
[[ -f .env ]] || { echo 'Production .env is missing' >&2; exit 1; }

git fetch origin main
[[ "$(git rev-parse FETCH_HEAD)" == "$sha" ]] || { echo 'Remote main no longer matches the published SHA' >&2; exit 1; }
git merge --ff-only FETCH_HEAD
[[ "$(git rev-parse HEAD)" == "$sha" ]] || { echo 'Oracle checkout does not match the published SHA' >&2; exit 1; }

# Change only IMAGE_TAG. Reject duplicates and preserve all other bytes and file permissions.
python3 - "$sha" <<'PY'
import os
import pathlib
import re
import stat
import sys
import tempfile

path = pathlib.Path('.env')
tag = ('IMAGE_TAG=sha-' + sys.argv[1]).encode('ascii')
original = path.read_bytes()
lines = original.splitlines(keepends=True)
matches = [i for i, line in enumerate(lines) if line.startswith(b'IMAGE_TAG=')]
if len(matches) > 1:
    raise SystemExit('Duplicate IMAGE_TAG entries in production .env')
if matches:
    line = lines[matches[0]]
    previous = line.rstrip(b'\r\n')
    if re.fullmatch(rb'IMAGE_TAG=sha-[0-9a-f]{40}', previous):
        print('Previous production ' + previous.decode('ascii'))
    ending = b'\r\n' if line.endswith(b'\r\n') else b'\n' if line.endswith(b'\n') else b''
    lines[matches[0]] = tag + ending
else:
    if original and not original.endswith((b'\n', b'\r')):
        lines.append(b'\n')
    lines.append(tag + b'\n')
updated = b''.join(lines)
if updated != original:
    fd, temporary = tempfile.mkstemp(prefix='.env.', dir='.')
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(updated)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, stat.S_IMODE(path.stat().st_mode))
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
if [line.rstrip(b'\r\n') for line in path.read_bytes().splitlines() if line.startswith(b'IMAGE_TAG=')] != [tag]:
    raise SystemExit('IMAGE_TAG verification failed')
PY

compose=(docker compose --env-file .env -f docker-compose.prod.yml)
"${compose[@]}" config --quiet
configured_images="$("${compose[@]}" config --images)"
for service in backend frontend; do
  grep -Fxq -- "ghcr.io/$repository-$service:sha-$sha" <<< "$configured_images" || {
    echo "$service Compose image does not match the published SHA" >&2
    exit 1
  }
done

# Production credentials are configured on the VM. Pull only the validated app images.
"${compose[@]}" pull backend frontend

# Provision Web Push once on the VM. Keep the private key in the runtime .env,
# never in the image, Git repository, action logs or the deploy SSH payload.
vapid_state="$(python3 - <<'PY'
from pathlib import Path

lines = Path('.env').read_text().splitlines()
values = []
for name in ('VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'):
    matches = [line.split('=', 1)[1].strip() for line in lines if line.startswith(name + '=')]
    if len(matches) > 1:
        raise SystemExit(f'Duplicate {name} entries in production .env')
    values.append(matches[0] if matches else '')
if bool(values[0]) != bool(values[1]):
    raise SystemExit('Incomplete VAPID key pair in production .env')
print('present' if values[0] else 'missing')
PY
)"
if [[ "$vapid_state" == missing ]]; then
  backend_image="ghcr.io/$repository-backend:sha-$sha"
  vapid_json="$(docker run --rm --network none --entrypoint node "$backend_image" -e 'process.stdout.write(JSON.stringify(require("web-push").generateVAPIDKeys()))')"
  VAPID_GENERATED_JSON="$vapid_json" python3 - <<'PY'
import json
import os
import pathlib
import re
import stat
import tempfile

path = pathlib.Path('.env')
keys = json.loads(os.environ['VAPID_GENERATED_JSON'])
replacements = {
    'VAPID_PUBLIC_KEY': keys['publicKey'],
    'VAPID_PRIVATE_KEY': keys['privateKey'],
}
if not all(re.fullmatch(r'[A-Za-z0-9_-]+', value) for value in replacements.values()):
    raise SystemExit('Generated VAPID keys are invalid')
lines = path.read_bytes().splitlines(keepends=True)
for name, value in replacements.items():
    prefix = (name + '=').encode('ascii')
    matches = [index for index, line in enumerate(lines) if line.startswith(prefix)]
    if len(matches) > 1:
        raise SystemExit(f'Duplicate {name} entries in production .env')
    if matches:
        index = matches[0]
        if lines[index].strip() != prefix:
            raise SystemExit(f'{name} changed during deployment')
        ending = b'\r\n' if lines[index].endswith(b'\r\n') else b'\n'
        lines[index] = prefix + value.encode('ascii') + ending
    else:
        lines.append(prefix + value.encode('ascii') + b'\n')
updated = b''.join(lines)
fd, temporary = tempfile.mkstemp(prefix='.env.', dir='.')
try:
    with os.fdopen(fd, 'wb') as output:
        output.write(updated)
        output.flush()
        os.fsync(output.fileno())
    os.chmod(temporary, stat.S_IMODE(path.stat().st_mode))
    os.replace(temporary, path)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
PY
  unset vapid_json
  echo 'Production Web Push keys provisioned.'
fi
"${compose[@]}" config --quiet
"${compose[@]}" up -d --no-build --no-deps --wait --wait-timeout 300 backend frontend
"${compose[@]}" ps

for service in postgres redis backend frontend; do
  container="$("${compose[@]}" ps -q "$service")"
  [[ -n "$container" ]] || { echo "$service container is missing" >&2; exit 1; }
  status="$(docker inspect --format '{{.State.Status}}' "$container")"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container")"
  [[ "$status" == running && "$health" == healthy ]] || { echo "$service is not running and healthy" >&2; exit 1; }
done

for service in backend frontend; do
  container="$("${compose[@]}" ps -q "$service")"
  image="$(docker inspect --format '{{.Config.Image}}' "$container")"
  [[ "$image" == "ghcr.io/$repository-$service:sha-$sha" ]] || { echo "$service is not using the published SHA image" >&2; exit 1; }
done

echo "Deployment healthy: sha-$sha"

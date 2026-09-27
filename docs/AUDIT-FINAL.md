# Auditoria final de dev e da configuração futura de main — 27/09/2026

**READY FOR DEV COMMIT**

**DEV DEVELOPMENT VALIDATED: YES**

**MAIN PRODUCTION CONFIG VALIDATED: YES**

Os dois blockers anteriores foram resolvidos: ambas as auditorias backend e a
auditoria frontend retornam zero vulnerabilidades; os onze artefatos locais foram
retirados somente do índice, mantendo suas cópias. Nenhum commit, push, checkout,
merge, publicação GHCR, acesso Oracle/Cloudflare ou deploy real foi executado.
Esta aprovação é para preparar/revisar o commit de dev, não uma implantação realizada.

## A. Branch dev

A branch ativa continua `dev`. `dev`, `main`, `origin/dev` e `origin/main` apontam
para `a2e2f5d53d2d3f80d452eb4dc45f3df389178cf2` (`clouds100`). A auditoria inicial
executou `git branch -vv`, `git status --short --untracked-files=all`, `git log
--oneline --decorate --graph --all -20`, `git diff main...dev` e `git diff main`.
O diff completo inicial foi registrado em `tmp/branch-audit-initial.diff`, ignorado.
Ao fim, `git fetch origin --prune` confirmou que as referências remotas continuam
no mesmo commit auditado; nenhuma atualização remota invalidou a comparação.
`git diff main...dev` permanece vazio: o trabalho ainda não foi commitado. As
alterações propostas são o working tree, os arquivos novos e onze remoções staged.

Desenvolvimento diário:

```bash
# Preencher .env e backend/.env com credenciais locais antes do primeiro uso.
docker compose up
```

Esse comando carrega `docker-compose.yml` + `docker-compose.override.yml`
automaticamente. Usa `backend/Dockerfile` target `development` e
`frontend/Dockerfile`, construídos localmente; não depende do GHCR.
Ambos os serviços declaram `NODE_ENV=development`. Nest usa `start:dev`/watch com
`tsconfig.dev.json`, Next usa `next dev --webpack`. Há binds de source, polling
compatível com Windows/Docker Desktop e volumes nomeados de node_modules.
Os entrypoints atualizam dependências com `npm ci` quando o checksum do lock muda.
`.gitattributes` preserva LF nos scripts shell. Saídas Nest `.dev-build/dist` e
Next `.next` ficam em volumes próprios, sem colisão com builds executados no host.
PostgreSQL e Redis persistem em volumes nomeados; Prisma gera client e aplica
migrations antes do watcher. Defaults locais: PostgreSQL 5433, Redis 6379,
frontend 3000, backend 3001; URLs locais vêm dos templates/.env.

`COMPOSE_PROJECT_NAME`, `DEV_*_CONTAINER_NAME`, `DEV_POSTGRES_PORT` e
`DEV_REDIS_PORT` permitem uma segunda stack local sem editar Compose. Defaults
preservam os nomes/portas existentes. Não são variáveis de produção.

Testou-se uma cópia isolada do mesmo repositório em `tmp/branch-validation-20260927`
usando o comando padrão `docker compose up`, seu `.env` fictício e o override
automático, sem arquivo extra de Compose. Nome `clouds-reviewed-dev`, portas
14000/14001/15433/16379, volumes próprios. Os 50 arquivos de código/configuração
modificados ou novos correspondem à cópia testada, normalizando apenas LF/CRLF.
Documentos Markdown não entram nessa comparação de executáveis/configuração.

Resultado: quatro serviços saudáveis; frontend, backend, PostgreSQL, Redis,
Prisma, BFF, login, logout, cookies sem Secure em dev, uploads multipart válidos,
rejeição de MIME inválido/campos aninhados, Socket.IO polling e WebSocket
autenticado aprovados. Houve duas alterações descartáveis em frontend/backend,
ambas detectadas por hot reload sem alteração dos IDs ou StartedAt dos containers.
Probes removidos e `Hello World!` restaurado. E2E existente: 1/1 aprovado.
PostgreSQL/Redis sobreviveram a down sem `-v` + up; autenticação repetida aprovou.

### Containers antigos preexistentes

Os quatro containers `clouds-*` originais foram preservados saudáveis. Eles já
executavam `NODE_ENV=production`, com `node dist/src/main.js` e `node server.js`,
criados por uma combinação antiga de Compose base + prod. Esse runtime antigo
não representa o `docker compose up` padrão revisado. Uma branch não modifica
containers já criados; Compose/target/variáveis determinam o modo de execução.
A nova dev foi validada separadamente, e a nova produção nunca combinou os arquivos.
Não se reconfigurou essa stack antiga nem se reutilizou seu banco nos testes.

## B. Branch main depois do merge

`main` não foi alterada. Receberá pelo merge dev → main o mesmo conjunto de
arquivos validado: aplicação, manifests/locks, Dockerfiles development/production,
Compose base/override/prod, scripts, templates .env, workflows e documentação.
**Nenhum Dockerfile, Compose ou código precisará de edição manual por branch.**
Produção é selecionada explicitamente:

```bash
docker compose --env-file /opt/clouds/.env -f docker-compose.prod.yml config
docker compose --env-file /opt/clouds/.env -f docker-compose.prod.yml pull
docker compose --env-file /opt/clouds/.env -f docker-compose.prod.yml up -d --no-build --wait
```

O arquivo prod é independente e não carrega o override automaticamente quando
especificado com `-f`. Não tem `build`, binds, volumes node_modules, polling,
`next dev` ou `nest start --watch`. PostgreSQL/Redis não publicam portas e usam
rede interna. Backend acessa `postgres:5432` e `redis:6379`; BFF server-side acessa
`http://backend:3001`. Browser usa a origem HTTPS pública fornecida no build, nunca
o hostname Docker nem localhost. As portas Node no host são somente loopback.
Next executa standalone `node server.js`; Nest executa `node dist/src/main.js`.
O comando Prisma migrate deploy termina antes do Nest; não há CLI/watchers
residentes, nem build em runtime. Healthchecks, migrations e persistência passaram.

Push dev e PR para main/dev acionam `ci.yml` → `validate.yml`, sem publicar.
Push main aciona `publish.yml` → validação → build linux/amd64 → teste local das
imagens exatas → login GHCR → publicação. Job publish tem guard explícito de main;
somente ele recebe `packages: write`. `workflow_dispatch` em dev não publica.
A validação cobre lint, TypeScript, testes, audits completos/runtime, application
builds, quatro Docker variants sem push e ambos os Composes.

Imagens futuras:

```text
ghcr.io/fabricioalffpagani-spec/cloudscommunity-backend:sha-<commit completo>
ghcr.io/fabricioalffpagani-spec/cloudscommunity-frontend:sha-<commit completo>
```

`latest` avança só após publicar as duas imagens SHA da main aprovadas. O workflow
recusa sobrescrever tags SHA existentes e falha se não puder confirmar sua ausência;
administradores externos ao workflow ainda precisam respeitar essa política.
Uma publicação parcialmente concluída exige revisão antes de retry/deploy.
Workflows foram analisados estaticamente e o script Bash validado com `bash -n`;
GitHub Actions/GHCR reais não foram acionados nesta etapa.

### Configuração externa, fora do Git

| Local | Configuração necessária |
| --- | --- |
| GitHub Repository Variables | NEXT_PUBLIC_CLOUDS_SOCKET_URL, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL com origens HTTPS públicas |
| GitHub Secrets | Nenhum secret adicional para o fluxo atual; GITHUB_TOKEN automático só autentica GHCR, com packages: write |
| Oracle .env | PGX_ADMIN_PASS, PGX_CONN_STR, eventual RESEND_API_KEY; usuário/banco, APP_WEB_ORIGIN, remetente, cookie domain opcional, GHCR_REPOSITORY e IMAGE_TAG |
| Oracle host | Docker/Compose, 4 GiB swap ativos, acesso de leitura GHCR se privado, firewall, proxy TLS, backups e volumes persistentes |
| Cloudflare | DNS, proxy e HTTPS configurados posteriormente; regras/proxy preservando cookies e upgrade WebSocket |

As três NEXT_PUBLIC são públicas e ficam no bundle do Next durante build; mudá-las
exige reconstruir a imagem. Dev usa URLs locais; main injeta as Repository Variables.
O validador de build rejeita URLs ausentes, HTTP, localhost e credenciais embutidas.
Banco, Resend e chaves Oracle jamais são build args ou secrets do bundle.

### Teste local da produção e memória

Stack `clouds-reviewed-prod`, portas 13000/13001, bancos/volumes exclusivos,
credenciais fictícias. Build e runtime em linux/amd64, ainda na dev. Fresh database
recebeu as 29 migrations; migrate status declarou schema atual, validate aprovou.
Prisma Client e CLI permanecem disponíveis após prune, sem Nest CLI/Jest no runtime.
Imagens executam usuário node, sem .env/chaves ou secrets no Config.Env da imagem.
Config.Env do container recebe somente os secrets de runtime exigidos.

| Serviço | RAM | RAM + swap | Ajuste |
| --- | --- | --- | --- |
| PostgreSQL | 192 MiB | 384 MiB | shared_buffers 64MB, 30 conexões, work_mem 2MB |
| Redis | 80 MiB | 160 MiB | maxmemory 64mb, noeviction, AOF |
| Nest | 320 MiB | 768 MiB | heap V8 192 MiB |
| Next standalone | 256 MiB | 768 MiB | heap V8 160 MiB |
| Total de tetos | 848 MiB | 2080 MiB | memswap_limit inclui RAM |

Medição cgroup v1 após startup/smoke/migrations: total da amostra **234,5 MiB**,
soma dos picos individuais **412,1 MiB**, sem OOM/restarts. Os picos por serviço
não são simultâneos; somá-los é um limite conservador para aquela execução.
O host Docker Desktop é maior que a VM Oracle; não se simulou a pressão global de
Ubuntu 24.04, Docker/proxy e 952 MiB físicos. 4 GiB de swap e monitoramento continuam
necessários; não há garantia de carga pesada ou disponibilidade sem observação real.
Redis ao atingir maxmemory rejeita escritas em vez de evictar presença; AOF também
precisa de margem. Uploads em memória e picos de queries exigem acompanhamento.

Imagens locais realmente testadas, sem publicação:

| Variante | Image ID sha256 |
| --- | --- |
| Backend production | a9e8d0f63cade0cf40e515e3e16907c65e4171bd83a69656d46c34e5d0eeef11 |
| Frontend production | 4de7245997a9e1bf0fba429bb6403e9454e149b161c3416c921d705ee664e69d |
| Backend development | 1e47159d84d63aaaecc50f53297720352e0b1a7a924d01848e38aa3a77b2a20a |
| Frontend development | 1785781557188749e67f5d2293f2b08144a16ef4b3ff9cb1f90561d26497a656 |

Production health/BFF/CORS, login/logout, Secure/HttpOnly/SameSite/domain, uploads,
Socket.IO e WebSocket autenticado passaram. PostgreSQL/Redis preservaram marcadores
após down sem `-v` + up, e auth passou novamente. Ambas as stacks de teste foram
finalmente encerradas com down sem `-v`; volumes e imagens de teste foram mantidos.

## C. Diferenças dev x production

| Item | Development | Production |
| --- | --- | --- |
| Branch de trabalho/release | dev | main após promoção |
| Compose | base + override automático | prod independente |
| Next | next dev --webpack | standalone |
| Nest | start:dev / watch | node dist/src/main.js |
| Build | máquina local | GitHub Actions |
| Imagens | locais | GHCR SHA aprovado |
| PostgreSQL port | 5433 local configurável | somente rede interna |
| Redis port | 6379 local configurável | somente rede interna |
| Source bind | sim | não |
| Volumes node_modules | sim | não |
| Hot reload/polling | sim | não |
| NEXT_PUBLIC URLs | locais | HTTPS públicas, build-time |
| Deployment | desenvolvimento local | Oracle, após configuração externa |

Os arquivos production existem intencionalmente na dev. Branches não são
alternativas com arquivos manualmente divergentes; dev prepara a próxima versão,
main passa a conter essa versão depois da revisão e integração.

## D. Git, arquivos e secrets

Inventário proposto: **38 modificados, 16 novos, 11 removidos somente do índice**.
Apenas essas onze remoções estão staged; aplicação/configuração/docs ainda estão
no working tree. Nenhum commit foi criado. README original era UTF-16 e agora é
UTF-8, por isso Git o apresenta como alteração binária contra aquela base.
Arquivos sem diferença de conteúdo recuperaram o CRLF esperado no checkout Windows;
isso removeu ruído de status sem reverter alterações semânticas.

### git status --short --untracked-files=all

```text
 M .env.example
 M .gitignore
D  .vscode/settings.json
 M README.md
 M backend/.dockerignore
 M backend/.env.example
 M backend/.gitignore
 M backend/Dockerfile
 M backend/package-lock.json
 M backend/package.json
 M backend/src/auth/auth.service.ts
 M backend/src/auth/auth.utils.ts
 M backend/src/clouds/cloud.controller.ts
 M backend/src/clouds/cloud.gateway.ts
 M backend/src/clouds/cloud.service.spec.ts
 M backend/src/clouds/topic-classification/semantic-topic-classifier.adapter.ts
 M backend/src/clouds/topic-classification/topic-classification.config.ts
 M backend/src/direct-messages/direct-messages.controller.ts
 M backend/src/direct-messages/direct-messages.gateway.ts
 M backend/src/direct-messages/direct-messages.service.spec.ts
 M backend/src/direct-messages/direct-messages.service.ts
 M backend/src/main.ts
 M backend/src/shared/runtime-env.ts
 M backend/src/users/users.service.ts
 M docker-compose.override.yml
 M docker-compose.prod.yml
 M docker-compose.yml
 M frontend/.dockerignore
 M frontend/.env.example
 M frontend/Dockerfile
 M frontend/Dockerfile.prod
 M frontend/app/api/_lib/nest-proxy.ts
 M frontend/app/api/trending/route.ts
D  frontend/app/page.tsx.backup
 M frontend/app/read/page.tsx
D  frontend/matches.txt
 M frontend/package.json
 M frontend/proxy.ts
 M frontend/tests/navigation.test.tsx
 M frontend/tests/read.test.tsx
 M frontend/vitest.config.mts
D  package-lock.json
D  query
D  start
D  tmp/pdfs/combined-legal-01.png
D  tmp/pdfs/combined-legal-10.png
D  tmp/pdfs/combined-legal-36.png
D  tmp_cloud.zip
D  tmp_page.zip
?? .env.production.example
?? .gitattributes
?? .github/workflows/ci.yml
?? .github/workflows/publish.yml
?? .github/workflows/validate.yml
?? backend/src/shared/runtime-env.spec.ts
?? backend/src/shared/upload-limits.ts
?? backend/tools/dev-entrypoint.sh
?? backend/tsconfig.dev.json
?? docs/AUDIT-FINAL.md
?? docs/DEPLOYMENT.md
?? docs/INFRASTRUCTURE-REPORT.md
?? frontend/tools/dev-entrypoint.sh
?? frontend/tools/validate-production-env.mjs
?? tools/verify-production-auth.cjs
?? tools/verify-production.mjs
```

### git diff HEAD --stat

```text
 .env.example                                       |   14 +-
 .gitignore                                         |   75 +-
 .vscode/settings.json                              |    2 -
 README.md                                          |  Bin 78 -> 1173 bytes
 backend/.dockerignore                              |   28 +
 backend/.env.example                               |    6 +-
 backend/.gitignore                                 |    2 +
 backend/Dockerfile                                 |   35 +-
 backend/package-lock.json                          |  230 +-
 backend/package.json                               |   25 +-
 backend/src/auth/auth.service.ts                   |    3 +-
 backend/src/auth/auth.utils.ts                     |    3 +-
 backend/src/clouds/cloud.controller.ts             |    9 +-
 backend/src/clouds/cloud.gateway.ts                |   28 +-
 backend/src/clouds/cloud.service.spec.ts           |   83 +-
 .../semantic-topic-classifier.adapter.ts           |    4 +-
 .../topic-classification.config.ts                 |   10 +-
 .../direct-messages/direct-messages.controller.ts  |    5 +-
 .../src/direct-messages/direct-messages.gateway.ts |   28 +-
 .../direct-messages.service.spec.ts                |   83 +-
 .../src/direct-messages/direct-messages.service.ts |   19 +-
 backend/src/main.ts                                |    7 +-
 backend/src/shared/runtime-env.ts                  |   28 +-
 backend/src/users/users.service.ts                 |   15 +-
 docker-compose.override.yml                        |   11 +-
 docker-compose.prod.yml                            |  114 +-
 docker-compose.yml                                 |   15 +-
 frontend/.dockerignore                             |   31 +
 frontend/.env.example                              |    3 +
 frontend/Dockerfile                                |    3 +-
 frontend/Dockerfile.prod                           |   35 +-
 frontend/app/api/_lib/nest-proxy.ts                |    2 +-
 frontend/app/api/trending/route.ts                 |    3 +-
 frontend/app/page.tsx.backup                       | 2294 --------------------
 frontend/app/read/page.tsx                         |    6 +-
 frontend/matches.txt                               |    0
 frontend/package.json                              |    1 +
 frontend/proxy.ts                                  |    1 +
 frontend/tests/navigation.test.tsx                 |    6 +-
 frontend/tests/read.test.tsx                       |   24 +-
 frontend/vitest.config.mts                         |    2 +-
 package-lock.json                                  |    6 -
 query                                              |    1 -
 start                                              |    1 -
 tmp/pdfs/combined-legal-01.png                     |  Bin 197126 -> 0 bytes
 tmp/pdfs/combined-legal-10.png                     |  Bin 165572 -> 0 bytes
 tmp/pdfs/combined-legal-36.png                     |  Bin 164815 -> 0 bytes
 tmp_cloud.zip                                      |  Bin 7376 -> 0 bytes
 tmp_page.zip                                       |  Bin 148 -> 0 bytes
 49 files changed, 627 insertions(+), 2674 deletions(-)
```

Esse stat inclui as remoções staged; arquivos novos ainda não staged não aparecem
no stat, mas estão listados com `??` no status acima. `git diff main...dev` é vazio
porque ambas as referências ainda apontam ao mesmo commit. `git diff --check` passou.

### Remoções do índice autorizadas

| Arquivo | Motivo |
| --- | --- |
| package-lock.json da raiz | Lock órfão, packages vazio, sem package.json raiz |
| .vscode/settings.json | Configuração local vazia |
| frontend/app/page.tsx.backup | Backup da página; não é aplicação ativa |
| frontend/matches.txt | Resultado de busca vazio |
| query e start | Nome de serviço PostgreSQL da máquina local |
| tmp/pdfs/combined-legal-01.png, -10.png, -36.png | Renders temporários de PDF |
| tmp_cloud.zip e tmp_page.zip | Arquivos de backup de código |

Executou-se `git rm --cached` apenas para esses onze caminhos. Todas as cópias
locais continuam presentes. Um index.lock vazio abandonado foi removido após
confirmar ausência de processo Git, para permitir a operação autorizada.
`git ls-files -ci --exclude-standard` retorna **vazio**, sem exceções.
Locks backend/frontend, migrations e documentos públicos legítimos permanecem.

### Ignorados e preservados

`.gitignore` cobre node_modules, .next, dist, .dev-build, coverage e .cache em
qualquer workspace, .env/.env.*, chaves pem/key/p12/pfx e nomes SSH, secrets,
credentials, backups, dumps, volumes, dump/sql.gz/sql.bz2/sqlite/db, tar/zip,
logs e arquivos temporários. `tmp/` e `docs/validation-logs/` ficam fora do commit.
As quatro exceções de templates foram preservadas; Dockerfiles, Composes,
Actions, migrations e docs de deployment não são ignorados.
Verificação direta: 24 caminhos que devem ser ignorados e dez templates/arquivos
que devem ser preservados aprovados. `.dockerignore` impede .env/chaves/credentials
nos contexts. Fixtures de exclusão de COPY foram testadas na auditoria anterior,
com as mesmas regras atuais, e removidas; nenhum .env real foi copiado à simulação.

Secrets locais não integram o inventário do commit. Nova varredura de **271 arquivos
textuais** da árvore proposta não encontrou assinaturas de tokens/chaves privadas.
Auditoria anterior de 851 blobs textuais do histórico permanece aplicável: refs
não mudaram. O .env histórico identificado continha URL SQLite `file:`, sem
usuário/senha/query token. Nenhuma credencial real de produção, chave SSH privada,
keystore ou dump foi identificado nos arquivos versionados analisados. Fixtures
fictícias não são credenciais de implantação. Não se afirma cobertura absoluta de
toda credencial possível em binários; uma descoberta futura exige rotação/revisão.

## E. Blockers, correções e validação

**Blockers de código/índice restantes: nenhum.** Avisos de lint/depreciação e os
limites de teste abaixo foram explicitados; as verificações retornaram sucesso.

### deepmerge-ts / Prisma

O registro npm foi consultado: maior Prisma 7 estável é 7.10.0, que ainda fixa
deepmerge-ts 7.1.5. Prisma latest é 8.0.0-rc.17, com mudanças de configuração,
schema, tipos e migrations; não foi adotado um RC para resolver este advisory.
Não existe patch/minor publicado mais recente da família 7 nessa consulta.

A correção compatível já foi aceita no upstream v7: [PR #30189](https://github.com/prisma/orm/pull/30189),
commit 93118fd, e [manifest v7](https://github.com/prisma/orm/blob/v7/packages/config/package.json).
O override local é restrito a **@prisma/config@7.10.0 → deepmerge-ts 8.0.2**,
reproduzindo essa mudança, não um override global sem suporte. Prisma/client/adapter
ficaram fixos em 7.10.0 para impedir expansão silenciosa do escopo auditado.
Revisaram-se os [breaking changes de deepmerge 8](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0):
os caminhos de Map/deepmergeInto alterados não são utilizados pelo config instalado;
o código efetivamente importa somente `deepmerge` para objetos de configuração.
Generate/validate, SQL migrations em banco novo, testes, builds e runtime real
passaram. Trocar para uma release estável que incorpore o fix exige nova validação;
nessa ocasião remover o override restrito. Nenhuma migration existente foi alterada.

Multer 2.3.0 (deduplicado com Nest), limites multipart planos e MySQL2 3.24.4
permanecem corrigidos. Não foi usado npm audit fix --force, downgrade Prisma,
allowlist de advisory ou remoção do audit da CI.

### Suíte final e resultados

| Verificação | Resultado |
| --- | --- |
| Backend npm ci | PASS Windows final e Linux/Alpine |
| Backend Prisma generate / validate | PASS host/build/runtime |
| Backend lint:check | PASS, 0 erros / 2 warnings |
| Backend typecheck | PASS |
| Backend unit tests | PASS, 56/56 em 6 suites |
| Backend E2E | PASS, 1/1 no banco de teste |
| Backend Nest build | PASS Windows e Docker Linux |
| Backend npm audit | PASS, zero vulnerabilidades |
| Backend npm audit --omit=dev | PASS, zero vulnerabilidades |
| Frontend npm ci | PASS Windows e Docker Linux |
| Frontend lint | PASS, 0 erros / 110 warnings |
| Frontend typecheck | PASS |
| Frontend npm test | PASS, 15/15 em 2 suites, repetição confirmada |
| Frontend npm run build | PASS Windows e Docker Next standalone |
| Frontend npm audit | PASS, zero vulnerabilidades |
| Quatro Docker variantes linux/amd64 | PASS |
| Compose dev padrão / prod independente | PASS |
| Smoke/auth/cookies/upload/WebSocket, dev e prod | PASS |
| Hot reload sem rebuild/restart, frontend/backend | PASS, duas versões, probes revertidos |
| Persistência PostgreSQL/Redis | PASS nas duas stacks, down sem -v |
| Memória production | PASS startup/smoke com limites aplicados; sem OOM/restart |
| Workflows YAML/guards/permissions e Bash syntax | PASS análise local; Action real não executada |
| Git diff --check / tracked ignored | PASS / vazio |

Warnings backend: bootstrap Promise não explicitamente aguardada e argumento any
de fixture de upload. Frontend: 110 avisos existentes, principalmente relacionados
às regras de imagens/hooks/variáveis. npm sinalizou depreciação de ESLint 9 e glob;
Prisma informou existência do RC 8. Esses avisos não foram ocultados nem tiveram
regras desativadas; npm audit retorna zero.

Falhas transitórias/harness resolvidas nesta revisão: lock Windows omitia dois
opcionais @emnapi necessários ao npm ci Linux; lock regenerado no Linux preservando
versões e validado novamente no Windows/Docker. Primeiro Vitest teve timeout ao
iniciar worker durante builds simultâneos, sem falha de asserção; repetição passou
integralmente sem mudar a configuração para mascarar o erro. Primeiro smoke dev
foi disparado antes do healthcheck frontend; repetido somente após healthy.
A medição precisou usar cgroup v1, pois este Docker Desktop não expõe os paths v2.
O teste inicial de soma de limites também foi corrigido para converter strings
numéricas do Compose; nenhuma dessas correções suprimiu verificação da aplicação.

Logs completos permanecem em `docs/validation-logs/` (ignorados). Não se testou
deployment real Oracle, Cloudflare/TLS/browser público, Resend real ou carga pesada.
Essas configurações externas são etapas posteriores, não diferenças entre branches.

## F. Estado final e próximos comandos — NÃO executados

**READY FOR DEV COMMIT**

Revise o diff e o inventário acima; os comandos abaixo incluem apenas as áreas
revisadas e respeitam os ignores. As onze remoções do índice já estão staged.

```bash
git status --short --untracked-files=all
git diff
git diff --cached
git add -- .env.example .env.production.example .gitattributes .gitignore README.md backend frontend .github tools docker-compose.yml docker-compose.override.yml docker-compose.prod.yml docs/AUDIT-FINAL.md docs/DEPLOYMENT.md docs/INFRASTRUCTURE-REPORT.md
git diff --cached --check
git diff --cached --stat
git ls-files -ci --exclude-standard
git commit -m "fix: validate development and production infrastructure"
git push origin dev
```

Fluxo seguro posterior: push origin/dev → CI verde → PR dev → main → revisão do
diff e das remoções → CI do PR verde → merge autorizado. Se main mudar antes disso,
atualizar a comparação/integração e repetir checks afetados. Não há conflito textual
conhecido porque o commit base das duas branches é idêntico; isso não substitui a
verificação do PR futuro. Antes do merge confirmar as três Repository Variables e
permissão GHCR; depois push main valida/testa/publica. Deployment Oracle continua
manual e separado, após secrets de runtime, swap, proxy HTTPS e backups preparados.

## Anexo — inventário de variáveis por ambiente

| Variável | Classe / uso |
| --- | --- |
| NEXT_PUBLIC_CLOUDS_SOCKET_URL, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL | Build-time públicas na produção; públicas de desenvolvimento em Next dev; ficam no bundle; mudança exige novo build |
| CLOUDS_BRIDGE_URL | Runtime server-only dev/prod; backend:porta no Docker; fixo http://backend:3001 no Compose production |
| APP_WEB_ORIGIN | Runtime dev/prod, público; lista explícita de origens; HTTPS em produção |
| APP_HTTP_PORT, UI_HTTP_PORT | Runtime dev (portas internas/host configuráveis); produção altera bindings do host, serviços internos fixos em 3001/3000 |
| PGX_CONN_STR | Secret runtime dev/prod e URL Prisma CLI; host postgres:5432 no Docker; nunca build arg |
| PGX_ADMIN_PASS | Secret runtime PostgreSQL/Compose; fora do Git; password da URL deve ser URL-encoded |
| POSTGRES_USER, POSTGRES_DB | Runtime interno do container PostgreSQL, alimentado pelos PGX correspondentes |
| POSTGRES_PASSWORD | Secret runtime interno do PostgreSQL, alimentado por PGX_ADMIN_PASS |
| PGX_ADMIN_USER, PGX_DB_NAME | Runtime dev/prod; identificadores de banco, não credenciais secretas isoladamente |
| CACHE_NODE_ENDPOINT | Runtime dev/prod; redis://redis:6379; se contiver autenticação, tratar URL como secret; produção fixa endpoint interno |
| RESEND_API_KEY | Secret runtime backend; nunca público ou build arg |
| RESEND_FROM_EMAIL | Runtime backend dev/prod, remetente público |
| SESSION_COOKIE_DOMAIN | Runtime dev/prod backend/frontend; opcional e idêntico; apenas domínios confiáveis |
| PASSWORD_RESET_EXPIRES_MINUTES | Runtime backend dev/prod, não secret |
| NODE_ENV | Runtime dev/prod selecionado pelo Compose/imagem |
| NODE_OPTIONS | Runtime produção, limite de heap; não secret |
| HOSTNAME, PORT | Runtime frontend standalone; PORT também é fallback do backend fora do Compose |
| WATCHPACK_POLLING, CHOKIDAR_USEPOLLING, TSC_WATCHFILE, TSC_WATCHDIRECTORY | Somente development runtime; ausentes no Compose production |
| NEXT_TELEMETRY_DISABLED | Build/runtime técnico não secret |
| COMPOSE_PROJECT_NAME | Configuração de implantação local, preserva prefixo de volumes |
| DEV_POSTGRES_CONTAINER_NAME, DEV_REDIS_CONTAINER_NAME, DEV_BACKEND_CONTAINER_NAME, DEV_FRONTEND_CONTAINER_NAME, DEV_POSTGRES_PORT, DEV_REDIS_PORT | Configuração opcional somente dev, nomes/portas para stacks locais isoladas |
| GHCR_REPOSITORY, IMAGE_TAG | Seleção pública das imagens production; tag SHA |
| GITHUB_TOKEN | Secret efêmero da Action de publicação, somente docker login; nunca no build |
| REGRESSION_FRONTEND_URL | Apenas script legado de regressão em ambiente de teste |
| VERIFY_ENV_FILE, DEPLOYMENT_TEST_ONLY, DEPLOYMENT_TEST_BACKEND_URL, DEPLOYMENT_TEST_FRONTEND_URL | Ferramentas de verificação em stacks isoladas; nunca necessários para a aplicação production |

Nomes de constantes como MESSAGE_LIMIT, STORAGE_KEY ou MIN_PASSWORD_LENGTH em
interpolação JavaScript não são variáveis de ambiente. Variáveis de CI do GitHub
para run_id, SHA, ref, actor e repository são metadados públicos de execução.

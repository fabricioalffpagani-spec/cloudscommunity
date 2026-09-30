# Desenvolvimento e produção

O checkout foi analisado na branch `dev`; `main` e `dev` apontavam para o mesmo
conteúdo inicial. As alterações são propostas na `dev`, para revisão e merge em
`main`. Nenhuma branch remota foi alterada e nenhuma imagem foi publicada nesta sessão.

`dev` é desenvolvimento e integração; `main` é a versão estável para produção.
Os arquivos de produção também ficam na `dev` para serem validados antes da promoção.
Depois do merge dev → main, nenhum Dockerfile, Compose ou código precisa ser editado
para mudar de ambiente: a seleção ocorre pelo Compose, target, variáveis e evento de CI.

## Desenvolvimento

```bash
cp .env.example .env
cp backend/.env.example backend/.env
# Edite as credenciais locais nos dois arquivos antes de iniciar.
docker compose up
docker compose logs -f backend frontend
```

O Compose carrega `docker-compose.override.yml` automaticamente. Mantém bind mounts,
Next dev com Webpack no Docker, Nest watch, polling do frontend/TypeScript e volumes de node_modules. O backend usa
explicitamente o target `development`. PostgreSQL fica em `localhost:5433`, Redis em
`localhost:6379`; frontend/backend usam as portas do `.env`.
O primeiro `up` constrói imagens ausentes. Após alterar Dockerfiles/dependências,
use `docker compose up -d --build`; alterações de código usam o hot reload.
`NODE_ENV=development` é explícito para ambos os serviços. Para uma segunda stack
local, configure `COMPOSE_PROJECT_NAME`, os quatro `DEV_*_CONTAINER_NAME` e
`DEV_POSTGRES_PORT`/`DEV_REDIS_PORT`, além das portas e URLs locais da aplicação.
São opções exclusivas de desenvolvimento e preservam os nomes/portas usuais por padrão.
Os entrypoints de desenvolvimento comparam o checksum do lockfile com o registrado
no volume `node_modules`. Se mudar, executam `npm ci` antes de iniciar o watcher;
um volume antigo também é atualizado na primeira inicialização.
O watcher Nest usa `tsconfig.dev.json` e escreve em `.dev-build/dist`, dentro de
um volume exclusivo do container; o build Nest de produção continua usando `dist`. Isso requer acesso
ao registro npm quando houver mudança. Os bancos não são removidos. Os scripts `.sh`
usam LF, inclusive após checkout no Windows, através de `.gitattributes`.
`PGX_CONN_STR` é obrigatório também em desenvolvimento; a senha padrão embutida
no helper foi removida. Use os `.env` locais, sempre fora do Git.
Se executar Node fora do Docker, use `localhost:5433` no `PGX_CONN_STR` e
`localhost:6379` no Redis, e `CLOUDS_BRIDGE_URL=http://localhost:3001` no frontend.
Prisma precisa de `generate` antes do build/teste do backend:

```bash
cd backend
npm ci
npm exec -- prisma generate
npm exec -- prisma validate
npm run typecheck
npm run lint:check
npm test -- --runInBand
npm run build
# npm run start:dev para execução local, com banco e Redis disponíveis
```

```bash
cd frontend
npm ci
npm run typecheck
npm run lint
npm test
npm run build
# npm run dev para execução local
```

## GitHub Actions e GHCR

`ci.yml` valida pushes na `dev` e PRs para `dev`/`main`, sem publicar imagens.
`validate.yml` é reutilizado pela CI e pela produção. Instala com `npm ci`, gera e
valida Prisma, executa lint sem `--fix`, TypeScript, testes existentes e builds.
As auditorias `npm audit` e `npm audit --omit=dev` também precisam passar, sem exceções.
Também valida os dois Composes e constrói quatro variantes Docker `linux/amd64`
(backend development/production e frontend development/production), sem publicar.
As demais validações continuam após um erro de lint, mas o job permanece reprovado.

`publish.yml` roda na `main` e aceita execução manual somente nessa branch. Só após
validação aprovada constrói as duas imagens `linux/amd64`, inicia a configuração
real de produção contra volumes exclusivos do runner, verifica saúde, BFF, CORS,
Socket.IO e isolamento, e publica os mesmos artefatos testados. O job `deploy` só
começa após `validate` e `publish` concluírem com sucesso; a concorrência
`ghcr-main` impede dois deploys simultâneos. A Oracle não compila imagens.

Repository **Variables** obrigatórias para produção:

| Nome | Exemplo fictício | Uso |
| --- | --- | --- |
| NEXT_PUBLIC_CLOUDS_SOCKET_URL | https://api.example.com | Socket.IO no navegador |
| NEXT_PUBLIC_APP_URL | https://app.example.com | Convites e links compartilhados |
| NEXT_PUBLIC_SITE_URL | https://app.example.com | Metadata/SEO |

São públicas e entram no bundle durante o build. Mudá-las exige reconstruir a imagem
no CI. O Dockerfile rejeita valores ausentes, localhost, HTTP, credenciais ou paths.
Socket.IO recebe uma origem `https://`; a biblioteca negocia polling HTTPS e upgrade
WebSocket WSS. Não use `wss://` como origem desse cliente Socket.IO.

Repository **Secrets** para o job de deploy (obrigatórios, exceto a porta):

| Nome | Valor a configurar no GitHub |
| --- | --- |
| `PROD_SSH_HOST` | Host/IP da VM Oracle |
| `PROD_SSH_USER` | Usuário SSH com acesso a `/opt/clouds` e Docker |
| `PROD_SSH_PRIVATE_KEY` | Chave privada dedicada ao deploy, sem passphrase interativa |
| `PROD_SSH_KNOWN_HOSTS` | Linha `known_hosts` verificada da VM, incluindo hostname/IP e chave pública |
| `PROD_SSH_PORT` | Porta SSH; opcional, padrão 22 |

Crie uma chave SSH exclusiva para o GitHub Actions. Instale somente sua chave
**pública** em `~/.ssh/authorized_keys` do usuário da VM. Cadastre a privada no
secret `PROD_SSH_PRIVATE_KEY`; nunca a coloque no repositório. Obtenha a chave
pública do host de uma fonte confiável ou compare o fingerprint com uma sessão
SSH já confiável antes de preencher `PROD_SSH_KNOWN_HOSTS`. Não use `ssh-keyscan`
isoladamente como prova de identidade. Para porta diferente de 22, a linha deve
identificar `[host]:porta`. O job exige validação estrita da chave do host.
O SSH da VM precisa aceitar conexões dos runners hospedados pelo GitHub, cujos
IPs podem mudar. Se a porta 22 for restringida futuramente, o deploy poderá
falhar até haver um runner com acesso autorizado; este workflow não altera
firewall nem Security Lists da Oracle.

O workflow usa o `GITHUB_TOKEN` automático com `packages: write` somente na
publicação. Não crie secrets de banco, JWT ou Resend para o build ou deploy; os
segredos de runtime continuam exclusivamente no `.env` da VM. O Docker login da
VM já deve conseguir ler os packages no GHCR. Se forem privados, configure na VM
um token de menor privilégio com `read:packages`, conforme abaixo; o job não
transmite esse token pelo SSH.

O deploy executa `git fetch origin main` e `git merge --ff-only` na VM, exigindo
checkout limpo e `main` remoto exatamente no SHA publicado. Atualiza somente
`IMAGE_TAG=sha-<SHA completo>` em `/opt/clouds/.env`, mantendo as outras linhas e
permissões, e recusa entradas duplicadas. Depois roda `docker compose pull` apenas
para `backend` e `frontend` e `up -d --no-build --no-deps --wait` para esses dois
serviços. PostgreSQL e Redis permanecem em execução e seus volumes não são
removidos. O job confirma saúde de todos os quatro serviços e verifica a tag das
imagens efetivamente usadas por backend e frontend. Por fim, exige HTTP 200 ou
307 do frontend público e HTTP 200 da API pública. Falhas deixam o workflow
reprovado; não há rollback automático destrutivo.

Para identificar o SHA em produção, consulte a linha `IMAGE_TAG` no `.env` da VM
(sem imprimir o arquivo inteiro) e compare com `docker inspect --format
'{{.Config.Image}}'` dos containers backend e frontend. Para rollback manual,
selecione uma tag `sha-<SHA anterior>` ainda publicada no GHCR, altere somente
`IMAGE_TAG` no `.env`, execute `docker compose --env-file .env -f
docker-compose.prod.yml pull backend frontend` e `up -d --no-build --no-deps
--wait backend frontend`, e confira saúde e endpoints. Revise antes a
compatibilidade das migrations: reverter a imagem não reverte o banco.

Imagens para o remote atual (o workflow calcula o nome em minúsculas):

```text
ghcr.io/fabricioalffpagani-spec/cloudscommunity-backend:sha-<SHA completo>
ghcr.io/fabricioalffpagani-spec/cloudscommunity-frontend:sha-<SHA completo>
ghcr.io/fabricioalffpagani-spec/cloudscommunity-backend:latest
ghcr.io/fabricioalffpagani-spec/cloudscommunity-frontend:latest
```

Use a mesma tag SHA nos dois serviços. `latest` avança somente na `main`, depois
de publicar ambas as tags SHA. Tags não são uma transação do registry: se uma publicação
falhar parcialmente, não faça deploy desse SHA até o workflow concluir.
Antes do push, o workflow verifica que nenhuma das tags SHA já existe; recusa
sobrescrever um artefato ou publicar se a consulta falhar por autenticação/rede.
Uma execução repetida de um SHA já publicado aborta. Essa proteção é do workflow;
administradores com acesso direto ao registry ainda podem alterar tags manualmente.
Multiarch foi adiado; os arquivos atuais fixam `linux/amd64` para a E2.1.Micro.
Os lockfiles fixam pacotes; as bases `node:24-alpine`, Postgres e Redis ainda são tags
mantidas pelos fornecedores. Rebuilds futuros podem incorporar updates dessas bases.

## Variáveis e segredos

| Variável | Classe | Momento/ambiente |
| --- | --- | --- |
| PGX_ADMIN_PASS | segredo | Runtime Postgres, local/produção |
| PGX_CONN_STR | segredo (contém senha) | Runtime backend/CLI migrations; nunca build |
| RESEND_API_KEY | segredo | Runtime backend, necessário para envio real de emails |
| PGX_ADMIN_USER, PGX_DB_NAME | configuração | Runtime Postgres, local/produção |
| CACHE_NODE_ENDPOINT | configuração (segredo se incluir autenticação) | Runtime backend; Compose produção fixa redis://redis:6379 |
| APP_WEB_ORIGIN | configuração pública, server-side | Runtime backend; lista explícita de origens, HTTPS na produção |
| APP_HTTP_PORT, UI_HTTP_PORT | configuração | Dev: portas internas/host; produção: apenas portas loopback do host |
| CLOUDS_BRIDGE_URL | configuração server-side | Next runtime, http://backend:3001 fixado no Compose produção |
| NEXT_PUBLIC_CLOUDS_SOCKET_URL | pública/build | Next dev runtime; Next produção build obrigatório |
| NEXT_PUBLIC_APP_URL | pública/build | Next dev; produção build obrigatório |
| NEXT_PUBLIC_SITE_URL | pública/build | Next dev; produção build obrigatório |
| SESSION_COOKIE_DOMAIN | configuração server-side | Runtime backend e Next proxy; opcional para subdomínios irmãos |
| RESEND_FROM_EMAIL | configuração | Runtime backend; remetente verificado no Resend |
| PASSWORD_RESET_EXPIRES_MINUTES | configuração | Runtime backend; padrão 30 |
| NODE_ENV | configuração | Dockerfile/Compose; development ou production |
| NODE_OPTIONS | configuração | Runtime produção, limites de heap |
| HOSTNAME, PORT | configuração | Next standalone runtime; 0.0.0.0:3000; PORT também é fallback do backend |
| NEXT_TELEMETRY_DISABLED | configuração | Build/runtime Next; 1 nos artefatos produção |
| WATCHPACK_POLLING, CHOKIDAR_USEPOLLING | somente desenvolvimento | Compose local; ausentes em produção |
| TSC_WATCHFILE, TSC_WATCHDIRECTORY | somente desenvolvimento | Polling Nest/TypeScript para bind mounts Windows/WSL, no override local |
| GHCR_REPOSITORY, IMAGE_TAG, COMPOSE_PROJECT_NAME | configuração de deployment | Interpolação Compose produção |
| REGRESSION_FRONTEND_URL | somente teste | Script existente backend/test/live-regression.cjs |
| VERIFY_ENV_FILE | somente teste | tools/verify-production.mjs; padrão /dev/null no Linux |

`EMAIL_VERIFICATION_EXPIRES_MINUTES` constava no exemplo, mas não é consumida:
verificação de email usa TTL fixo de 30 minutos no código. O exemplo foi corrigido.
Não há JWT secret atualmente: sessões são tokens aleatórios, com hash e estado no
PostgreSQL. Não foi inventada uma configuração JWT sem consumidor.
Todos os `.env` reais são ignorados pelo Git e excluídos dos contextos Docker.
Somente exemplos fictícios são versionados. Não compartilhe a saída de
`docker compose config` completo com secrets reais; use `config --quiet`.

## Oracle: instalação e deploy

Pré-requisitos: Ubuntu 24.04 x86_64, Docker/Compose com suporte a `--wait`, 4 GB de
swap configurados, espaço em disco para imagens/volumes e um proxy TLS antes de
servir usuários. A aplicação utiliza cookies `Secure` em produção e requer HTTPS.
Não foi instalado proxy ou Cloudflare nesta etapa.

Copie `docker-compose.prod.yml` e `.env.production.example` para `/opt/clouds`.
O arquivo de produção é **independente**: nunca combine com `docker-compose.yml`
ou `docker-compose.override.yml`, pois estes são de desenvolvimento.

```bash
sudo install -d -m 750 -o "$USER" -g "$USER" /opt/clouds
cd /opt/clouds
# Copie os dois arquivos citados antes de continuar.
umask 077
cp .env.production.example .env
chmod 600 .env
${EDITOR:-nano} .env
```

Edite localmente todos os placeholders: senha forte, usuário, banco, `PGX_CONN_STR`
com hostname `postgres:5432`, origem HTTPS, remetente/API key e tag SHA aprovada.
Faça percent-encoding da senha somente na URL PostgreSQL. Não exponha senha na CLI.
Para imagens privadas, autentique-se uma vez com um token **read:packages** da conta
autorizada; use um gerenciador de credenciais quando disponível:

```bash
read -r -p 'GitHub user: ' GHCR_USER
read -r -s -p 'Token com read:packages: ' GHCR_READ_TOKEN
echo
printf '%s' "$GHCR_READ_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
unset GHCR_READ_TOKEN
```

Se os packages forem públicos, `docker login` pode ser dispensado.
Deploy e updates, depois de preencher `.env`:

```bash
cd /opt/clouds
docker compose --env-file .env -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env -f docker-compose.prod.yml up -d --no-build --wait --wait-timeout 300
docker compose --env-file .env -f docker-compose.prod.yml ps
curl --fail http://127.0.0.1:3001/health
curl --fail http://127.0.0.1:3000/login
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=100 backend frontend
```

Nunca use `--build` na Oracle. Para atualizar, edite `IMAGE_TAG` com o SHA novo,
faça backup e repita `pull`/`up`. Não precisa de `down`. Migrations pendentes são
aplicadas pelo backend antes de iniciar o processo Nest, e um erro impede o startup.
`exec` entrega sinais ao processo Node, `init: true` recolhe subprocessos, e Nest
recebe shutdown hooks. Rollback de imagem não desfaz migrations; revise compatibilidade
do schema antes de selecionar uma imagem antiga.

## Volumes, backups e migrations

Volumes lógicos `clouds_postgres_data` e `clouds_redis_data` permanecem persistentes.
O prefixo depende do project name. O diretório atual normalmente usa
`cloudscommunity_clouds_postgres_data`. Antes de migrar uma instalação existente:

```bash
docker volume ls
docker inspect clouds-postgres --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}'
```

Confirme o nome real do volume e mantenha `COMPOSE_PROJECT_NAME` correspondente.
Não aponte para um volume novo por engano. Para dados em outro prefixo, revise o
mapeamento antes de iniciar. Não execute simultaneamente dev e produção sobre o mesmo
volume PostgreSQL. Os testes deste trabalho usam outro project name/volumes.

**Nunca execute `docker compose down -v` em produção.** Não foi criado qualquer
script que exclua volumes, execute `migrate reset` ou faça limpeza destrutiva.
A migration existente `20260925000000_remove_clouders` remove colunas; ela não foi
modificada. `migrate deploy` é o mecanismo correto, mas não torna qualquer SQL
intrinsecamente não destrutivo: revise migrations pendentes e faça backup primeiro.

Backup manual (exige permissões para escrever no diretório):

```bash
cd /opt/clouds
umask 077
mkdir -p backups
docker compose --env-file .env -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/clouds-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Copie os backups para outro local seguro e teste restauração em banco isolado.
Nenhuma rotina de retenção/exclusão foi introduzida.

## Memória e Redis

| Serviço | Limite container | Ajuste |
| --- | --- | --- |
| PostgreSQL | 192 MiB RAM / 384 MiB RAM+swap | shared_buffers 64MB, max_connections 30, work_mem 2MB, maintenance_work_mem 32MB |
| Redis | 80 MiB RAM / 160 MiB RAM+swap | maxmemory 64mb, noeviction, AOF mantido |
| Backend | 320 MiB RAM / 768 MiB RAM+swap | V8 heap 192 MiB; migration termina antes de iniciar Nest |
| Frontend | 256 MiB RAM / 768 MiB RAM+swap | V8 heap 160 MiB; Next standalone, um processo |

São tetos, não reservas. A soma dos limites de RAM é 848 MiB; o máximo agregado de
RAM+swap é 2080 MiB. `memswap_limit` inclui RAM. A Oracle de aproximadamente 952 MiB
deve ter 4 GiB de swap ativos; Ubuntu, Docker e proxy precisam de memória além dos
serviços e podem usar swap. O teste local de startup com esses limites não reproduz
a pressão global da VM nem garante carga pesada. Monitore `docker stats`, `free -h`,
`docker inspect ...State.OOMKilled` e latência. A VM de 1 GB pode precisar de upgrade.
Não limite CPU num único vCPU compartilhado; não há builds/watchers em produção.
Healthchecks de produção são a cada 30s, com tolerância maior ao startup/migrations.
Docker reinicia processos que saem, mas `unhealthy` sozinho não reinicia um container.

Redis é usado para Pub/Sub do adapter Socket.IO e contadores `chat:presence:*`
(`INCR`, `DECR`, `DEL`), sem filas, sessões ou cache genérico identificado.
Sessões, mensagens e arquivos/media são armazenados no PostgreSQL. Os contadores
de presença não possuem TTL/reconciliação: após crashes podem ficar desatualizados.
Mantivemos AOF e `noeviction` para não mudar silenciosamente sua semântica. Ao atingir
64mb, Redis rejeita novas escritas; acompanhe memória/erros. Corrigir presença após
crashes ou permitir eviction exige trabalho funcional separado.

## Proxy, CORS e Socket.IO

PostgreSQL/Redis não têm portas publicadas e usam rede `data` interna. Frontend usa
`web`; backend conecta às duas e pode enviar email para fora. Os serviços Node são
publicados apenas em `127.0.0.1`, para um proxy no host. Um proxy em container deve
entrar na rede `web` e acessar `frontend:3000`/`backend:3001`; não use o localhost
desse container para alcançar o host.

Configure no futuro TLS, Host/X-Forwarded-Proto confiáveis, upgrade WebSocket e timeout
de conexão longa. Encaminhe `/socket.io/` sem reescrever seu path. Não confie em headers
de forwarding vindos diretamente da Internet. Mantenha portas de aplicação fora do
firewall público e exponha apenas 80/443 no proxy, além do SSH administrativo restrito.

O frontend HTTP usa BFF `/api/*`; o Socket.IO conecta diretamente à origem pública
configurada no build. CORS HTTP e das duas namespaces usa apenas `APP_WEB_ORIGIN`.
`allowRequest` também rejeita origens de navegador não autorizadas no handshake,
incluindo WebSocket (CORS sozinho só controla polling).

Cookies de sessão são HttpOnly/Secure/SameSite=Lax. Para `app.example.com` e
`api.example.com`, configure `SESSION_COOKIE_DOMAIN=.example.com` nos dois runtimes
e use apenas subdomínios confiáveis. Logout e limpeza do Next usam o mesmo domínio.
Deixar vazio mantém cookie host-only. Uma alternativa mais isolada é servir Socket.IO
por `/socket.io/` na origem do frontend (URL pública do socket igual à do app), sem
cookie compartilhado. Domínios registráveis diferentes não são suportados por esse
cookie Lax; não mude SameSite/segurança sem análise própria.

## Dependências e compatibilidade

Versões do lockfile inicial: Node local 24.13.0, Next 16.3.5, React/ReactDOM 19.2.4,
Nest core 11.2.5, Prisma/client/adapter 7.10.0, pg 8.18.0, Redis client 6.2.1,
TypeScript 5.9.3. Node 24 atende os engines instalados; não houve downgrade.
Alpine é compatível com os artefatos musl de Next/sharp e Prisma; OpenSSL foi incluído
explicitamente no backend para o schema engine de migrations.
Prisma 7 usa adapter-pg no runtime; o client gerado e os engines de CLI permanecem
no node_modules de produção. Schema, migrations e `prisma.config.ts` são copiados.

Backend production dependencies auditadas:

| Pacotes | Necessidade |
| --- | --- |
| @nestjs/common, core, platform-express | Aplicação HTTP Nest |
| @nestjs/platform-socket.io, websockets, socket.io | Gateways Socket.IO |
| @prisma/client, @prisma/adapter-pg, pg | Client e conexão PostgreSQL |
| prisma | CLI para migrate deploy no startup; movida para dependencies |
| redis, @socket.io/redis-adapter | Presença/PubSub |
| reflect-metadata, rxjs | Runtime Nest/decorators |
| resend | Emails backend |
| express, dotenv | Imports diretos já existentes; agora declarados explicitamente, nas versões já travadas |
| multer 2.3.0 (direto e override no Nest) | memoryStorage e FileInterceptor; correções de segurança minor, uma única versão no runtime |

CLI Nest, schematics, testing, ESLint e plugins, Prettier, types, Jest, ts-jest,
Supertest, ts-loader, ts-node, tsconfig-paths, TypeScript e source-map-support ficaram
em devDependencies. `npm prune --omit=dev` remove as ferramentas exclusivamente de
desenvolvimento. TypeScript 5.9.3 também é peer opcional transitivo da CLI Prisma
(`>=5.4`), portanto o npm o mantém no runtime; não foi removido manualmente para
não quebrar o contrato da CLI de migrations/configuração. Nest CLI e Jest não ficam
na imagem final.
Não há peerDependencies/optionalDependencies diretas declaradas nos manifests;
peers e opcionais transitivos continuam governados pelo lockfile/npm, sem `--omit=optional`.
O lockfile do backend foi ajustado para preservar instalação limpa em Linux.
`@types/multer` é uma dependência de desenvolvimento explícita; o tipo de arquivo é
`Express.Multer.File`. O override `prisma.mysql2=3.24.4` corrige os advisories desse
driver transitivo, preservando o major 3; a aplicação usa PostgreSQL.
Os quatro endpoints de upload rejeitam campos multipart aninhados e índices de
arrays, usando os limites do Multer 2.3; todos os metadados usados pela aplicação
são campos planos. A CLI Prisma gera seu client após o prune num estágio separado
do build da aplicação, permitindo reaproveitar esse estágio quando somente o
código da aplicação muda.

A correção transitiva usa `@prisma/config@7.10.0 → deepmerge-ts 8.0.2` através de
um override restrito à versão auditada, com Prisma/client/adapter fixados em 7.10.0.
Não há patch/minor estável mais recente no registro npm consultado em 27/09/2026;
Prisma 8 está em RC e não foi adotado. O override reproduz a correção já aceita
na branch oficial Prisma v7, no [PR #30189](https://github.com/prisma/orm/pull/30189).
O código de config usa apenas `deepmerge` para objetos planos, não os caminhos de
Map/deepmergeInto alterados no major 8. Essa compatibilidade foi revisada e a
configuração local validada com generate, validate, migrations e execução real.
Não é um override global nem uma atualização forçada de Prisma. Remova-o quando
uma versão estável compatível incorporar a correção, após repetir a validação.
Ambas as auditorias npm devem permanecer obrigatórias. Consulte
[AUDIT-FINAL.md](AUDIT-FINAL.md) para resultados e inventário do commit proposto.

Frontend: Next, React, ReactDOM e socket.io-client são usados; standalone seleciona
automaticamente os arquivos necessários. `resend` está em dependencies, mas não foi
encontrado import no frontend: permaneceu para evitar remoção de escopo não solicitado;
o tracing standalone evita carregá-lo sem necessidade. Tailwind/PostCSS são necessários
no build. Types, TypeScript, ESLint/config-next, Vitest, jsdom, testing-library são de
desenvolvimento/teste. SWC, sharp/libvips, oxide e rolldown têm binários específicos de
plataforma: nunca copie node_modules Windows para a imagem Linux.

Fontes são links externos no HTML; o build não usa `next/font/google` para baixar fontes.
Não há custom server Next, export estático ou arquivos runtime externos ao frontend
que impeçam o standalone. `next.config.ts` já tinha `output: standalone` e foi preservado.

Referências oficiais consultadas:
[Prisma system requirements](https://docs.prisma.io/docs/orm/reference/system-requirements),
[Next installation](https://nextjs.org/docs/app/getting-started/installation),
[Next standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
Também foram lidos os guias da versão instalada em `frontend/node_modules/next/dist/docs`.

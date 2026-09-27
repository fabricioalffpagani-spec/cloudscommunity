# Relatório de infraestrutura — revisão de 27/09/2026

**READY FOR DEV COMMIT**

**DEV DEVELOPMENT VALIDATED: YES**

**MAIN PRODUCTION CONFIG VALIDATED: YES**

Esta revisão substitui o diagnóstico inicial de 26/09: lint/TypeScript/testes
foram corrigidos, audits retornam zero vulnerabilidades e os onze arquivos locais
saíram apenas do índice. Consulte [AUDIT-FINAL.md](AUDIT-FINAL.md) para as seções
A–F, inventário exato do commit proposto, warnings e limitações dos testes.
Consulte [DEPLOYMENT.md](DEPLOYMENT.md) para comandos e configuração externa.

## Um repositório, seleção por ambiente

`dev` é desenvolvimento e integração; `main` contém a versão estável aprovada.
Ambas terão Dockerfiles, Composes, workflows e documentação dos dois ambientes
depois da promoção dev → main. Os arquivos production existem na dev para serem
testados antes dessa promoção. Não há arquivos que precisem de conteúdo distinto
por branch nem edições manuais depois do merge.

| Seleção | Development na dev | Production da futura main |
| --- | --- | --- |
| Compose | docker compose up; base + override automático | somente -f docker-compose.prod.yml |
| Backend | Dockerfile target development; Nest watch | target production; node dist/src/main.js |
| Frontend | Dockerfile; Next dev --webpack | Dockerfile.prod; Next standalone |
| Source/node_modules | bind + volumes nomeados | somente conteúdo da imagem |
| URLs públicas | .env local | NEXT_PUBLIC Repository Variables no build |
| Banco/Redis | acesso local conveniente, portas configuráveis | rede interna, sem portas publicadas |
| CI | validação, sem publicação | validação + build/testes + GHCR |
| Oracle | nenhum deploy de desenvolvimento | usa imagens prontas, nunca build na VM |

Prisma/Redis/PostgreSQL e volumes continuam disponíveis em desenvolvimento.
NODE_ENV=development é explícito nos dois serviços; polling é somente dev.
Saídas Nest .dev-build e Next .next ficam isoladas dos builds no host. Checksum
do lock atualiza volumes de dependências. Nomes/portas DEV_* opcionais permitem
segunda stack local mantendo os defaults históricos. Produção não depende dessas
variáveis nem herda overrides, binds, watchers ou volumes de node_modules.

## Workflows

ci.yml valida push dev e PR para dev/main. validate.yml roda npm ci, Prisma
generate/validate, lint, TypeScript, testes, npm audit completo/runtime e builds;
também constrói quatro variantes linux/amd64 sem push e valida os Composes.
publish.yml aceita somente publicação da main, após toda a validação e smoke/auth
das imagens exatas contra bancos isolados. Só o job publish tem packages: write.
As tags são ghcr.io/fabricioalffpagani-spec/cloudscommunity-{backend,frontend}:sha-<SHA>.
Tags SHA existentes não são sobrescritas pelo workflow; latest avança somente
após ambas as publicações aprovadas da main. Não existe deploy automático Oracle.

## Correções e evidências

- Prisma/client/adapter 7.10.0 fixos. Override restrito config@7.10.0 → deepmerge-ts
  8.0.2 reproduz correção aceita no upstream v7, com breaking changes revisados e
  validação completa. Não houve downgrade, audit fix --force ou migração para RC 8.
- Multer 2.3.0 deduplicado no Nest e limites para campos multipart planos;
  MySQL2 transitivo 3.24.4. As três auditorias npm finalizaram com zero vulnerabilidades.
- Backend: lint 0 erros/2 warnings, TS aprovado, 56 unit tests, 1 E2E e build aprovados.
- Frontend: lint 0 erros/110 warnings, TS aprovado, 15 testes e build aprovados.
- npm ci passou no Windows e Linux. Lock final inclui opcionais necessários ao
  Alpine. Quatro Docker variantes linux/amd64 foram construídas.
- Dev testada pelo Compose padrão com .env fictício, sem arquivo Compose extra:
  duas alterações frontend/backend detectadas sem restart/rebuild e revertidas.
- Dev e prod: quatro serviços saudáveis, Prisma/migrations, BFF, auth, cookies,
  uploads e Socket.IO polling/WebSocket autenticado passaram. PostgreSQL/Redis
  preservaram dados após down sem -v; autenticação repetida passou.
- Onze artefatos locais/temporários removidos somente do índice, cópias presentes.
  git ls-files -ci --exclude-standard vazio. Nenhum secret real identificado na
  árvore proposta; .env/chaves continuam ignorados e fora dos contexts de imagem.

## Memória para Oracle E2.1.Micro

RAM: PostgreSQL 192 MiB, Redis 80 MiB, backend 320 MiB, frontend 256 MiB; soma
848 MiB. RAM+swap: 384/160/768/768 MiB, soma 2080 MiB. Heap V8 192 MiB Nest e
160 MiB Next; PostgreSQL shared_buffers 64MB/30 conexões; Redis maxmemory 64mb,
noeviction e AOF preservados. CLI migrations termina antes do Nest; não há watchers
ou builds em runtime. Startup/smoke com esses limites passaram sem OOM/restart.
Medição cgroup: 234,5 MiB na amostra e 412,1 MiB na soma dos picos individuais.

O Docker Desktop não reproduz a pressão global do Ubuntu 24.04 numa VM de 952 MB.
4 GiB de swap, monitoramento e teste posterior no host continuam necessários;
resultado local não garante carga pesada. SO, Docker e proxy também consomem RAM.

## Main depois do merge e configuração externa

main receberá exatamente a versão validada na dev; push main acionará o pipeline
production. Não será necessário editar Dockerfiles, Compose ou código.
Configurar depois, fora do Git: três NEXT_PUBLIC Repository Variables HTTPS,
permissão GHCR pelo GITHUB_TOKEN automático, .env Oracle com secrets de runtime
(PGX_ADMIN_PASS/PGX_CONN_STR/RESEND_API_KEY), DNS/proxy/HTTPS Cloudflare, swap,
backups e firewall. BFF usa backend:3001, backend usa postgres:5432 e redis:6379,
browser usa a URL pública do socket. Nenhum secret entra no bundle Next.

As referências dev/main/origin permanecem a2e2f5d. Nenhum commit/push/merge,
publicação GHCR ou deploy externo ocorreu. Stacks de teste encerradas sem -v;
volumes de teste retidos e quatro containers originais preservados saudáveis.
Os originais já eram production de uma configuração combinada antiga; não devem
ser confundidos com o novo Compose dev padrão ou o novo prod independente.

Revisão do diff e autorização precedem git add/commit/push. Depois: CI verde em
dev, PR dev → main, CI/revisão aprovados, merge autorizado, pipeline main aprovado.
Cloudflare, TLS/browser real, Resend real e carga na Oracle não foram executados.

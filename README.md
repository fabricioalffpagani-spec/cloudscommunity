# Clouds Community

Next.js 16, NestJS 11, PostgreSQL 16, Redis 7 e Prisma 7, com Node.js 24.

`dev` é desenvolvimento e integração; `main` é a versão estável para produção.
Os arquivos dos dois ambientes ficam nas duas branches após o merge dev → main.

Desenvolvimento local usa `docker compose up --build --watch`, após preencher os
exemplos `.env.example` e `backend/.env.example`. O override local mantém hot
reload via Compose Watch, sem o bind mount do frontend que é instável no Docker
Desktop para Windows.

Produção usa exclusivamente `docker-compose.prod.yml`, com imagens prontas do GHCR:
`docker compose --env-file .env -f docker-compose.prod.yml pull` e
`docker compose --env-file .env -f docker-compose.prod.yml up -d --no-build --wait`.
Não combine os arquivos de desenvolvimento com o Compose de produção.

Veja [deployment e variáveis](docs/DEPLOYMENT.md) para configurar GitHub/Oracle,
segredos, volumes persistentes, backups, proxy TLS e limites de memória.
Veja [relatório de infraestrutura](docs/INFRASTRUCTURE-REPORT.md) para a evolução
das configurações e os resultados de validação.
Veja [auditoria final da dev e do merge](docs/AUDIT-FINAL.md) para o estado atual,
as correções, o `.gitignore` e as pendências antes do commit.

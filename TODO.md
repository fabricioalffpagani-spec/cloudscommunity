## TODO (cloudscommunity)

- [x] Remover link "Login" do Header na rota inicial (`frontend/app/page.tsx`).
  - (Verificado: o header em `page.tsx` não continha link de Login — item já estava resolvido.)
- [x] Implementar no `frontend/app/page.tsx` um check de primeira visita via `localStorage`.
  - [x] Se primeira visita: fazer `router.replace('/login')`.
  - [x] Se já visitou: renderizar o feed normal.
- [x] Validar comportamento em:
  - [x] Primeira abertura (rota `/` vai para `/login`).
  - [x] Reabertura após refresh (rota `/` permanece no feed).

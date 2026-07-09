# TODO — Clouds Community (Auth OTP)

- [ ] Implementar envio real do OTP por e-mail via Resend
- [x] Instalar dependência `resend`
- [x] Atualizar endpoint `/api/auth/send-code` para enviar via Resend
- [ ] Configurar variáveis de ambiente no ambiente de execução:
  - [ ] `RESEND_API_KEY`
  - [ ] (opcional) `RESEND_FROM` (fallback usado: `@cloudscommunity.site`)
- [ ] Testar fluxo de signup: solicitar código → verificar e-mail


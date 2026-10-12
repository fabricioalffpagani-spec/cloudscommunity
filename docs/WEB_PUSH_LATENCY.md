# Diagnóstico de latência do Web Push

## O que foi encontrado no código

- A notificação **“Nova Cloud de alguém que você segue”** é criada após a transação que cria a Cloud. O backend chama `PushNotificationsService.send()` na mesma requisição, sem fila, Redis ou retry. A consulta de seguidores, a criação da notificação e as consultas de subscription/contador ocorrem entre a criação da Cloud e o HTTP ao provedor; esse intervalo precisa ser medido em produção.
- Antes da correção, uma Cloud que continuava outra conversa aguardava o Web Push ao autor original antes de consultar e avisar os seguidores. Agora os dois caminhos iniciam em paralelo e cada chamada ao provedor tem timeout de socket de 15 segundos. Esse bloqueio era possível, mas não há logs históricos suficientes para afirmar que ocorreu no caso relatado.
- Antes desta correção, todo push usava `TTL: 43200` segundos (12 horas) e a urgência padrão `normal` do pacote `web-push`. O TTL é o limite de retenção no provedor, não um agendamento de envio. A prioridade `normal` pode permitir adiamento por economia de energia.
- O backend configura VAPID a partir de `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`. O pacote `web-push` compõe os cabeçalhos de autenticação e criptografia; agora recebe `TTL` e `urgency` explícitos. Não há cabeçalhos customizados nem `Topic`: agrupar pushes de mensagens/Clouds no serviço poderia substituir um aviso ainda não entregue. A configuração não registra nem revela as chaves.
- O endpoint da subscription é único no banco. O cliente troca uma subscription quando a chave VAPID muda e o backend apaga subscriptions rejeitadas com HTTP 404/410. Não há deduplicação por aparelho além da unicidade do endpoint. Uma subscription antiga que ainda receba sucesso do provedor não pode ser identificada como obsoleta apenas pelo HTTP.
- O service worker não usa fila ou timer para exibir o push recebido. Para mensagens de Cloud, ele pode aguardar até 500 ms para saber se há uma janela visível acompanhando a conversa.
- Todos os avisos enviados por Web Push usam `high` com TTL de 10 minutos. O aviso permanece no banco mesmo se um push expirar após o TTL. A urgência solicita entrega imediata ao provedor, mas o navegador e o sistema operacional ainda controlam a exibição no aparelho.

## Ensaio controlado

1. Habilite `PUSH_TIMING_DIAGNOSTICS=1` **somente durante o ensaio**. Os logs contêm apenas um UUID aleatório, índice da subscription, timestamps UTC, TTL, urgência e status HTTP. Não contêm usuário, endpoint, chaves VAPID, título ou corpo.
2. Em dois dispositivos com o PWA instalado e permissão de notificações, feche o PWA. Anote modelo, navegador, estado de economia de bateria e hora local com segundos. No Android, inspecione o service worker com as ferramentas remotas do navegador para ver `push_timing` no console, quando possível.
3. Crie uma Cloud pública com uma conta seguida pelas contas de teste. Anote o horário da criação. No backend, correlacione `event`, `send`, `response` e `status` pelo campo `trace` (e `subscription` se a conta tiver mais de uma).
4. No console do service worker, anote `pushReceivedAt` e `showNotificationAt`. No próprio dispositivo, anote a hora em que a notificação apareceu. Os quatro horários usam relógios diferentes; sincronize os aparelhos ou registre a diferença de relógio antes de calcular latência entre servidores e celulares.
5. Repita com um aparelho Samsung em economia de bateria normal e, se autorizado pelo dono, com o PWA em “Nunca suspender”. Faça a comparação apenas se o backend tiver registrado o envio imediato e a aceitação pelo provedor.
6. Desabilite `PUSH_TIMING_DIAGNOSTICS` após coletar evidências suficientes. Remova a instrumentação opcional quando o estágio do atraso estiver confirmado.

## Interpretação

- `event → send` alto: investigar consultas/contensão no banco e o processamento síncrono de seguidores. Não há job neste fluxo.
- `send → response` alto ou HTTP não 2xx: investigar provedor, rede e falhas. Não há retry automático no código atual.
- Resposta 2xx rápida, mas `pushReceivedAt` tardio: atraso entre provedor e service worker; verificar urgência, estado de energia, rede e navegador.
- `pushReceivedAt` rápido, mas `showNotificationAt` tardio: investigar o service worker. Para avisos de criação de Cloud, ele chama `showNotification()` sem a verificação de janela de mensagens.
- `showNotificationAt` rápido, mas aviso visível tardio: investigar o sistema de notificações do aparelho.

O teste automatizado do backend mede apenas o caminho com um provedor simulado; não prova a entrega em um aparelho real. O teste do service worker mede apenas um evento simulado.

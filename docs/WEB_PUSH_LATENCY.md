# Investigação da latência do Web Push

## Histórico e causa

- `907e31b` (29/09/2026) introduziu o service worker de Web Push. Não existe registro de teste em aparelho que permita afirmar qual foi o último commit comprovadamente funcional com o PWA fechado.
- `a2be0f0` (04/10/2026) passou a aguardar `clients.matchAll()` antes de chamar `showNotification()` para mensagens de Cloud.
- `b4263b9` (08/10/2026) ainda chamava `showNotification()` diretamente para mensagens privadas. É o último estado de código com esse comportamento, não uma comprovação histórica em aparelho.
- `f43dbd6` (09/10/2026) passou a aguardar `getNotifications()` antes de mostrar mensagens privadas. Em reprodução controlada, uma rejeição dessa consulta impede a chamada de `showNotification()`; o código anterior ainda exibia o aviso. A notificação de **criação de Cloud por alguém seguido** não passava por essa consulta, então essa mudança não explica sozinha todo relato anterior.
- `00996d0` (12/10/2026) fez o evento `push` chamar `showNotification()` imediatamente para todos os tipos de aviso, sem depender de consultas de janelas ou notificações anteriores. Os testes de regressão simulam falha nessas consultas e ausência de janela aberta.

## Caminho no backend

- Mensagens privadas e criação de Cloud chamam `PushNotificationsService.send()` na requisição que gera o evento. Não há fila Redis, job ou retry nesse caminho. O backend chama `webpush.sendNotification()` com `TTL: 600`, `urgency: high` e timeout de 15 segundos. Não usa `Topic` ou cabeçalhos customizados; o pacote `web-push` monta a autenticação VAPID. Subscriptions rejeitadas com HTTP 404/410 são removidas.
- O endpoint da subscription é único no banco. Uma subscription antiga que ainda recebe HTTP 201 não pode ser identificada como obsoleta apenas por essa resposta. A permissão atual do navegador e a subscription persistida são estados distintos.
- No ensaio de 12/10/2026, os nove pushes correlacionados pelos identificadores aleatórios foram enviados entre **17 e 112 ms** após o evento. Todos receberam HTTP **201** do serviço push, sem retry. Nenhum desses resultados sustenta atraso no backend.

## Ensaio em produção de 12/10/2026

O SHA de diagnóstico foi `5aa478afa9e0c4963c09f4c7b9f57243d426a496`. Dois aparelhos e dois perfis receberam notificações do Android com o PWA totalmente fechado, antes de abrir a aplicação, segundo confirmação de quem realizou o teste. Os registros abaixo foram correlacionados entre backend e service worker no aparelho destinatário. Horários em UTC; subtraia 3 horas para São Paulo. `HTTP 201` significa aceitação pelo serviço push, não exibição no Android.

| Evento       | Envio Web Push | Evento → envio | Resposta            | `push` no SW | Envio → SW | SW → `showNotification()` |
| ------------ | -------------- | -------------: | ------------------- | ------------ | ---------: | ------------------------: |
| 23:04:37.523 | 23:04:37.593   |          70 ms | 201 às 23:04:37.962 | 23:04:41.455 |    3,862 s |                     35 ms |
| 23:06:14.008 | 23:06:14.078   |          70 ms | 201 às 23:06:14.413 | 23:06:17.091 |    3,013 s |                     37 ms |
| 23:09:30.511 | 23:09:30.597   |          86 ms | 201 às 23:09:31.075 | 23:09:36.255 |    5,658 s |                     64 ms |
| 23:09:32.696 | 23:09:32.785   |          89 ms | 201 às 23:09:33.020 | 23:09:36.621 |    3,836 s |                      0 ms |
| 23:09:34.430 | 23:09:34.490   |          60 ms | 201 às 23:09:34.738 | 23:09:36.690 |    2,200 s |                      0 ms |
| 23:10:24.695 | 23:10:24.712   |          17 ms | 201 às 23:10:25.017 | 23:10:30.187 |    5,475 s |                     65 ms |
| 23:11:37.877 | 23:11:37.900   |          23 ms | 201 às 23:11:38.194 | 23:11:43.771 |    5,871 s |                     51 ms |

Nos dois registros fornecidos pelo outro aparelho, o service worker recebeu o push 0,651 s e 1,651 s após o envio; os dois tiveram HTTP 201. O relatório desse aparelho mostrou `permission: denied` **quando a página de diagnóstico foi consultada**, apesar de o usuário confirmar que o Android exibiu avisos com o PWA fechado. Não há timestamp de mudança de permissão ou identificação do contexto do navegador para explicar essa divergência. A subscription aparecia ativa, e uma subscription ativa por si só não prova permissão atual de exibição.

O ensaio comprova o fluxo backend → serviço push → service worker → chamada de `showNotification()` e a exibição no Android com o PWA fechado nos dois aparelhos. Ele não prova que toda combinação de navegador, versão do Android ou economia de bateria terá o mesmo tempo. Tampouco identifica qual etapa causou as horas de atraso nos episódios anteriores, pois não havia timestamps do service worker nesses episódios. A falha histórica demonstrada no código era a dependência das consultas assíncronas antes de exibir alguns tipos de aviso.

## Limpeza

A página, o payload e os logs temporários de `PUSH_TIMING_DIAGNOSTICS` são removidos após o ensaio. Permanecem a chamada imediata de `showNotification()`, `TTL: 600`, `urgency: high`, a remoção de subscriptions HTTP 404/410 e os testes de regressão. Caso a falha reapareça, será necessário novo ensaio controlado com os horários de cada etapa.

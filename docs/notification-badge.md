# Ícone de notificações no Android

O service worker usa `/pwa-512x512.png` como `icon` da notificação expandida e
`/clouds-notification-badge-v2.png` como `badge` da barra de status. O badge é
um PNG RGBA de 96 × 96 px, branco, monocromático, com fundo transparente e
contorno reforçado para continuar legível após a redução e a máscara do Android.
O manifesto também oferece o mesmo asset com propósito `monochrome`; o ícone
colorido maskable continua reservado à instalação do PWA.

O navegador e o fabricante podem substituir ou ocultar o badge. No Chrome para
Android, o badge depende de permissão de notificações, inscrição Web Push ativa
e suporte do sistema. A Badging API do ícone do app é independente do `badge`
da notificação. Em iOS, a apresentação da barra de status é controlada pelo
sistema e não equivale à do Android.

Para conferir em dispositivos reais, reinstale ou atualize o PWA para ativar o
novo service worker, autorize notificações, envie uma DM de outra conta com o
app fechado e verifique a barra de status e a notificação expandida. Repita em
Chrome Android e, se possível, em Samsung Internet/One UI. A aparência exata
da cor e do recorte pode variar conforme a máscara e o tema do aparelho.

# Mini Cloud fora da aplicação

O Mini Cloud usa a API `window.documentPictureInPicture.requestWindow()` para abrir o chat em uma janela sempre visível. A mesma instância React e a conexão Socket.IO continuam ativas nessa janela. A janela depende da aba/PWA que a abriu e fecha com ela.

O Chrome documenta o lançamento de **Document Picture-in-Picture apenas no desktop**. Chrome Android/PWA não oferece uma janela Document PiP para HTML interativo; o Picture-in-Picture de vídeo não comporta o composer e os controles do chat. Por isso, no Android o Mini Cloud permanece arrastável dentro do app, e o botão externo informa a indisponibilidade quando a API não existe. Em qualquer navegador com suporte futuro, o botão tenta abrir a janela por detecção da API, sem bloquear por plataforma.

Referência: [Chrome for Developers — Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture/), seção Status: “Launch Complete (Desktop)”.

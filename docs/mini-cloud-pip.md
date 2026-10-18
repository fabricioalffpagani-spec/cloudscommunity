# Mini Cloud fora da aplicação

No desktop, minimizar uma Cloud mostra o Mini Cloud flutuante dentro da aplicação.
Ele pode ser arrastado e redimensionado. O botão explícito “Abrir Mini Cloud
fora da aba” abre a rota autenticada `/mini-cloud` em uma janela independente.
Essa janela mantém sua própria conexão Socket.IO e continua aberta quando a
pessoa navega para fora ou fecha a aba principal do Clouds. Ela fecha quando a
pessoa sai da Cloud ou a fecha manualmente.

A rota externa usa o mesmo chat e a mesma assinatura Socket.IO, mas ocupa toda
a área de conteúdo da janela: `html`, `body` e o dock não acrescentam margens,
padding, bordas ou deslocamento. O tamanho solicitado ao abrir é o tamanho
atual do Mini Cloud interno. Se a pessoa redimensionar a janela pelo navegador,
o dock acompanha a área disponível. O controle de arraste e redimensionamento
do dock permanece exclusivo do modo interno.

Não é possível manter qualquer interface web aberta depois que o navegador é
encerrado por completo; esse limite é imposto pelo sistema operacional e pelo
navegador. Em dispositivos móveis, o Mini Cloud permanece arrastável dentro do
app.

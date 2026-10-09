# Mini Cloud fora da aplicação

No desktop, o Mini Cloud abre a rota autenticada `/mini-cloud` em uma janela
independente do navegador. Ela mantém sua própria conexão Socket.IO e continua
aberta quando a pessoa navega para fora ou fecha a aba principal do Clouds. A
janela é fechada quando a pessoa sai da Cloud ou a fecha manualmente.

Não é possível manter qualquer interface web aberta depois que o navegador é
encerrado por completo; esse limite é imposto pelo sistema operacional e pelo
navegador. Em dispositivos móveis, o Mini Cloud permanece arrastável dentro do
app.

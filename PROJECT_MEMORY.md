# Visão Geral do Projeto

* **Objetivo do sistema**: Plataforma Clouds Community para conversas efêmeras, enquetes, ranking de perfis e mensagens diretas, seguindo especificações detalhadas em Copy.txt e Design System.txt
* **Tecnologias utilizadas**: 
  - Next.js 16.2.9 (App Router)
  - TypeScript
  - React 19.2.4
  - Tailwind CSS 4.0
  - Prisma ORM (configurado, mas não utilizado na implementação atual)
* **Estrutura principal**:
  - `/src/app` - Páginas da aplicação usando Next.js App Router
  - `/src/components` - Componentes reutilizáveis
  - `/assets` - Arquivos fornecidos (Copy.txt, Design System.txt, imagens) - Mantidos intocáveis
* **Principais módulos**:
  - Feed (Home)
  - Criação de Clouds (texto, áudio, enquete)
  - Meet (Ranking)
  - Messages (Mensagens Diretas)
  - Settings (Configurações)

# Arquitetura

* **Framework utilizado**: Next.js 16.2.9 com App Router (arquivo src/app/page.tsx como página inicial)
* **Organização de pastas**:
  - src/app/ - Contém todas as páginas da aplicação
  - src/components/ - Componentes reutilizáveis organizados por categoria
  - src/components/layout/ - Componentes de layout (header, footer, etc.)
  - src/components/ui/ - Componentes básicos (botões, inputs, etc.)
  - src/components/cards/ - Cards de conteúdo
  - src/components/feed/ - Componentes específicos do feed
  - src/components/avatar/ - Componentes de avatar
  - src/components/audio/ - Componentes de player de áudio
* **Convenções adotadas**:
  - Exportação nomeada para componentes (exceto páginas que usam export default)
  - Uso extensivo de variáveis CSS do Design System em arquivos .tsx
  - Componentes funcionais com TypeScript
  - Estrutura de pastas seguindo boas práticas do Next.js App Router
* **Padrões de desenvolvimento**:
  - Mobile-first com breakpoints para tablet (≥768px) e desktop (≥1024px)
  - Acessibilidade WCAG AA considerada (contraste, navegação por teclado, aria-labels)
  - HTML semântico (header, main, section, nav, button)
  - Estados de loading e tratamento de erro básico implementado
  - Interações com hover states e foco visível

# Dependências Críticas

Listar:
* **next**: ^16.2.9 - Framework React para renderização server-side e geração estática - Motivo: Framework principal escolhido para o projeto - Impactos conhecidos: Requer Node.js >=20.9.0
* **react**: 19.2.4 - Biblioteca principal para construção de interfaces - Motivo: Biblioteca padrão para desenvolvimento de SPAs modernos - Impactos conhecidos: Compatível com Next.js 16.2.x
* **react-dom**: 19.2.4 - Para renderização React no DOM - Motivo: Necessário para funcionamento do React - Impactos conhecidos: Versão específica para compatibilidade com React 19.2.4
* **typescript**: ^5 - Tipagem estática para melhor desenvolvimento e manutenção - Motivo: Melhora qualidade do código e detecta erros em tempo de compilação - Impactos conhecidos: Requer configuração tsconfig.json adequada
* **tailwindcss**: ^4 - Framework CSS utility-first seguindo exatamente o Design System - Motivo: Permite implementação fiel do design system fornecido - Impactos conhecidos: Requer configuração postcss.config.mjs e tailwind.config.ts
* **@tailwindcss/postcss**: ^4 - Integração do Tailwind com PostCSS - Motivo: Necessário para processamento do Tailwind CSS - Impactos conhecidos: Deve ser compatível com a versão do tailwindcss
* **@radix-ui/react-scroll-area**: ^1.2.11 - Componentes de scroll acessíveis para filtros de categoria - Motivo: Melhora acessibilidade e experiência do usuário em listas roláveis - Impactos conhecidos: Nenho conhecido significativo
* **@prisma/client**: ^7.7.0 & **prisma**: ^6.19.3 - ORM para acesso ao banco de dados (configurado, mas não utilizado na implementação atual) - Motivo: Preparação para integração futura com backend/banco de dados - Impactos conhecidos: Requer Node.js >=20.19 ou >=22.12 ou >=24.0 (incompatível com Node.js 18, necessitando upgrade para Node.js 20+)
* **eslint**: ^9 & **eslint-config-next**: "16.2.3" - Linting para qualidade de código - Motivo: Mantém padrão de código e detecta problemas potenciais - Impactos conhecidos: Requer configuração específica para Next.js
* **@types/node**: ^20, **@types/react**: ^19, **@types/react-dom**: ^19 - Definições TypeScript - Motivo: Fornece tipagem para bibliotecas Node.js e React - Impactos conhecidos: Devem ser compatíveis com as versões das bibliotecas principais

# Histórico de Problemas e Soluções

## Problema 1: Classe CSS inexistente 'border-border'
**Sintomas**: CssSyntaxError: Cannot apply unknown utility class `border-border`
**Causa Raiz**: No arquivo src/app/globals.css, havia uma regra `* { @apply border-border; }` que tenta aplicar uma classe inexistente no Tailwind CSS
**Solução Aplicada**: Remover a regra problemática, pois o Design System especifica bordas muito específicas que devem ser aplicadas componente a componente
**Arquivos Modificados**: src/app/globals.css (linha 56 removida)
**Como Evitar no Futuro**: Verificar se todas as utility classes do Tailwind existem antes de usá-las; seguir exatamente as especificações do Design System para bordas

## Problema 2: Importação de fontes do Next.js incompatível
**Sintomas**: Module not found: Can't resolve 'next/font/google/target.css'
**Causa Raiz**: Possível incompatibilidade de versão ou forma incorreta de importar fontes do Google no Next.js 13+
**Solução Aplicada**: Substituir a importação complexa do next/font/google por link padrão do Google Fonts no head do documento e aplicar as fontes via classes CSS
**Arquivos Modificados**: 
- src/app/layout.tsx (removido import next/font/google, adicionado link Google Fonts no head)
- src/app/globals.css (mantido as variáveis de fonte para uso nos componentes)
- Atualização de todas referências de font-[var(--*)] para usar as classes font-ui e font-display
**Como Evitar no Futuro**: Verificar a documentação oficial do Next.js para a versão específica sendo usada; testar importações de fontes em ambiente de desenvolvimento antes de aplicar em todo o projeto

## Problema 3: Erro de sintaxe JSX no estado vazio do feed
**Sintomas**: Expected '</', got 'ident' na linha 91 do src/app/page.tsx
**Causa Raiz**: Problema no balanceamento de parênteses, chaves ou tags JSX na expressão ternária que renderiza clouds ou estado vazio
**Solução Aplicada**: Reestruturar a expressão ternária para garantir que todos os parênteses, chaves e tags JSX estejam corretamente balanceados; remover comentários JSX desnecessários que estavam causando confusão no parser
**Arquivos Modificados**: src/app/page.tsx (linhas 83-106)
**Como Evitar no Futuro**: Usar formatador de código (Prettier) consistentemente; manter estruturas ternárias simples; validar JSX com ferramentas de linting antes de executar

## Problema 4: Exports nomeados vs default incorretos
**Sintomas**: Export CategoryFilter doesn't exist in target module, Export FloatingActionButtons doesn't exist in target module, etc.
**Causa Raiz**: Os componentes estavam sendo exportados como export default, mas estavam sendo importados como exports nomeados ({ Componente })
**Solução Aplicada**: Corrigir as importações em src/app/page.tsx para usar import default em vez de import nomeado para os componentes que estavam exportados como default
**Arquivos Modificados**: src/app/page.tsx (linhas 1-4)
**Como Evitar no Futuro**: Verificar sempre como cada componente está sendo exportado (export default vs export function/componente); manter consistência nas exportações pelo projeto

## Problema 5: Referências a variáveis CSS não resolvidas
**Sintomas**: Erros de compilação relacionados a var(--*) não resolvidos
**Causa Raiz**: Uso de funções @apply do Tailwind com variáveis CSS que não estavam sendo processadas corretamente em todos os contextos
**Solução Aplicada**: 
1. Substituir `@apply bg-[var(--bg-root)] text-[var(--text-primary)]` por propriedades CSS diretas
2. Converter todas as referências de text-[var(--*)] para usar as classes de utility do Tailwind definidas no tailwind.config.ts
3. Converter todas as referências de font-[var(--*)] para usar as classes font-ui e font-display
**Arquivos Modificados**: 
- src/app/globals.css 
- src/app/layout.tsx
- src/app/page.tsx
- Muitos componentes em src/components/ para remover var(--*) e usar classes diretas
**Como Evitar no Futuro**: Limitar o uso de variáveis CSS complexas em utility classes do Tailwind; preferir usar as utility classes diretamente quando possível; testar compilação após cada mudança significativa

## Problema 6: Warning sobre múltiplos lockfiles
**Sintomas**: Warning: Next.js inferred your workspace root, but it may not be correct. We detected multiple lockfiles...
**Causa Raiz**: Existência de um package-lock.json em C:\Users\segan\package-lock.json além do correto em C:\Users\segan\Documentos\cloudscommunity\package-lock.json
**Solução Aplicada**: Remover o lockfile incorreto que estava causando confusão no Next.js
**Arquivos Modificados**: Remoção de C:\Users\segan\package-lock.json
**Como Evitar no Futuro**: Manter o projeto em seu próprio diretório sem criar lockfiles em diretórios pai; ser cuidadoso ao executar comandos npm em diferentes contextos

## Problema 7: Porta 3000 em uso
**Sintomas**: Port 3000 is in use by process..., using available port 3001 instead.
**Causa Raiz**: Processo Next.js anterior ainda estava rodando na porta 3000
**Solução Aplicada**: Finalizar o processo existente com taskkill /PID [número] /F antes de iniciar nova instância
**Arquivos Modificados**: Nenhum (procedimento operacional)
**Como Evitar no Futuro**: Sempre verificar se processos anteriores foram finalizados antes de iniciar nova instância de desenvolvimento; usar portas diferentes para projetos diferentes se necessário

## Problema 8: CSS inválido gerado durante build (após correções iniciais)
**Sintomas**: Parsing CSS source code failed - Unexpected token Delim('*') em arquivos CSS gerados
**Causa Raiz**: Seletores CSS inválidos sendo gerados durante o build do Tailwind, provavelmente devido a alguma configuração incorreta ou uso de sintaxe não suportada
**Solução Aplicada**: 
1. Revisar completamente o arquivo src/app/globals.css removendo qualquer sintaxe CSS inválida
2. Garantir que todas as regras CSS estejam válidas e seguindo padrões do CSS standard
3. Manter apenas as variáveis CSS necessárias e evitar seletores complexos que possam causar problemas no processo de build do Tailwind
**Arquivos Modificados**: src/app/globals.css (reescrito completamente para remover seletores inválidos)
**Como Evitar no Futuro**: Evitar seletores CSS complexos ou não padrão em arquivos globais; testar build após cada modificação significativa no CSS

## Problema 9: Incompatibilidade de versão do Node.js com dependências
**Sintomas**: npm warnings about EBADENGINE Unsupported engine para múltiplos pacotes incluindo @prisma/client, @tailwindcss/oxide, eslint-visitor-keys, next
**Causa Raiz**: As dependências exigiam Node.js >=20 enquanto o ambiente estava usando Node.js 18
**Solução Aplicada**: 
1. Atualizar o Dockerfile para usar Node.js 20-alpine ao invés de Node.js 18-alpine
2. Garantir que o ambiente de desenvolvimento local também use Node.js 20+ quando possível
**Arquivos Modificados**: Dockerfile (alterado de node:18-alpine para node:20-alpine)
**Como Evitar no Futuro**: Verificar os requisitos de Node.js das dependências antes de escolher a versão base do Docker/ambiente de desenvolvimento

# Decisões Arquiteturais

* **Next.js App Router**: Decidido por usar a estrutura src/app/ em vez da antiga pages/ para aproveitar as funcionalidades mais recentes do Next.js 13+
* **Componentização granular**: Criar componentes reutilizáveis para todos os elementos repetitivos (botões, inputs, cards, etc.) facilitando manutenção e consistência
* **Separação de responsabilidades**: Organizar componentes por função (layout, ui, feed, avatar, audio) para melhor descobribilidade
* **Variáveis CSS centralizadas**: Definir todas as cores, espaçamentos, raios e tipografia no :root do globals.css para facilitar atualizações globais
* **Mobile-first absoluto**: Todas as estilizações desenvolvidas considerando mobile primeiro, com adaptações para telas maiores apenas quando necessário
* **Acessibilidade por design**: Integrar considerações de acessibilidade desde o início plutôt que como após-pensamento
* **Tipografia conforme Design System**: Usar Space Grotesk para títulos de alto impacto e Inter para todo o resto, exatamente como especificado

# Padrões de Design

Baseado obrigatoriamente no Design System.txt:

* **Cores**:
  - Primária: #9333EA (Roxo 500) - Usada em botões de ação primária, bordas de foco
  - Primária Hover: #7C3AED (Roxo 600) - Estado de hover em botões primários
  - Primária Press: #6D28D9 (Roxo 700) - Estado active/pressed em botões primários
  - Superfícies: 
    - BG Raiz: #09090B (fundo da página)
    - BG Nav: #111827 (header/navbar)
    - Surface 1: #1C1F2E (cards principais)
    - Surface 2: #252840 (inputs de formulário)
    - Surface 3: #2E3157 (estado hover de cards)
    - Surface 4: #3B3E6B (tooltips, popovers)
  - Texto:
    - Texto Primário: #F9FAFB (títulos, nomes, conteúdo principal)
    - Texto Secundário: #9CA3AF (subtítulos, descrições, labels)
    - Texto Terciário: #6B7280 (timestamps, contadores, placeholders)
  - Status:
    - Sucesso: #22C55E (Verde Vivo) - Status online, indicador AO VIVO
    - Erro: #EF4444 (Vermelho) - Erros, alertas críticos
    - Hypar: #F97316 (Laranja Hypar) - Ícone e contador de Hypar
  - Categorias (cada uma com fundo específico e texto branco):
    - Drama: #EC4899
    - Funny: #EAB308
    - Pop/Politics: #3B82F6 (Azul)
    - Sports/Real Life: #10B981 (Verde)
    - Tech: #06B6D4 (Ciano)
    - Gaming: #8B5CF6 (Roxo)
    - Music: #F472B6 (Rosa)
    - Movies: #F59E0B (Âmbar)
    - Memes: #84CC16 (Lima)
    - For You: Fundo branco #FFFFFF, texto #111827 (único com fundo branco)
    - Trending: Fundo primário #9333EA, texto branco

* **Tipografia**:
  - Famílias:
    - Space Grotesk - Títulos de alto impacto (H1, display)
    - Inter - UI, corpo de texto, labels, botões, dados
  - Escala (baseada em razão 1.25):
    - Display/Hero: Space Grotesk 700 · 64px / 4rem · lh 1.05
    - H1 - Título de página: Space Grotesk 700 · 32px / 2rem · lh 1.15
    - H2 - Título de seção: Inter 600 · 22px / 1.375rem · lh 1.3
    - H3 - Subtítulo / Card: Inter 500 · 16px / 1rem · lh 1.4
    - Body - Texto corrido: Inter 400 · 14px / 0.875rem · lh 1.65
    - Caption / Label: Inter 500 · 12px / 0.75rem · lh 1.4 · spacing 0.08em · uppercase
    - Micro / Timestamp: Inter 400 · 11px / 0.6875rem · lh 1.4
  - Regras:
    - Letter-spacing: apenas em labels e captions (+ 0.08em a +0.12em)
    - Maiúsculas (uppercase): reservadas exclusivamente para labels de seção e eyebrows
    - Alinhamento: padrão à esquerda, centralizado apenas em estados vazios e pódio
    - Truncamento: textos longos em cards truncados com reticências após a segunda linha
    - Hierarquia por cor, não por tamanho: dentro de um card, usar cor para diferenciar importância

* **Espaçamento**:
  - Base de 4px: todos os valores de margin, padding e gap devem ser múltiplos de 4
  - Tokens:
    - --space-1: 4px (gap mínimo entre ícone e texto)
    - --space-2: 8px (gap entre elementos relacionados dentro de um componente)
    - --space-3: 12px (gap entre cards em grid)
    - --space-4: 16px (padding interno de cards)
    - --space-5: 20px (padding horizontal de cards maiores)
    - --space-6: 24px (espaçamento entre seções de conteúdo)
    - --space-8: 32px (margem entre grupos principais de conteúdo)
    - --space-12: 48px (espaçamento entre seções principais)
    - --space-16: 64px (padding vertical do header)

* **Componentes**:
  - Botões: Todos com border-radius de 999px (pill), nunca quadrados ou levemente arredondados
    - Primário: Fundo sólido roxo, texto branco
    - Secundário: Sem fundo, com borda visível branca semitransparente
    - Ghost: Apenas texto colorido, sem fundo nem borda
    - Destrutivo: Sem fundo, borda vermelha para comunicar risco
    - Pequeno: Versão compacta do primário (padding reduzido) para uso dentro de cards
  - Inputs: Fundo Surface 2 (#252840), borda sutil que ganha cor roxa ao entrar em foco, border-radius 12px
  - Cards de Cloud: Fundo Surface 1 (#1C1F2E), border-radius 16px, cursor pointer em todo o card
  - Pills de Categoria: Fundo na cor da categoria, texto branco, padding horizontal
  - Player de Áudio Inline: Varia conforme contexto (feed vs chat)
  - Avatar com Inicial: Círculo com roxo primário como fundo padrão, inicial em branco
  - Badge AO VIVO: Ponto verde animado + texto 'AO VIVO' + tempo restante
  - Hypar: Ícone de chama (🔥) com estado ativo (laranja) e inativo (texto secundário)

* **Responsividade**:
  - Mobile-first: todos os estilos desenvolvidos para mobile primeiro
  - Breakpoints: tablet (≥768px) e desktop (≥1024px) com ajustes específicos quando necessário
  - Área de toque mínima: 44x44px em todos os elementos interativos
  - Fontes legíveis sem zoom necessário

* **Estética**:
  - Sistema de Border-Radius: 
    - 4px (--radius-xs): Badges de status, indicadores
    - 8px (--radius-sm): Inputs e campos de formulário
    - 12px (--radius-md): Inputs maiores, botões de seleção
    - 16px (--radius-lg): Cards principais (maior radius do sistema)
    - 24px (--radius-xl): Painéis e containers de seção
    - 999px (--radius-pill): Botões, pills, avatares (elementos oval)
  - Sistema de Bordas e Elevação: profundidade comunicada pela cor de fundo, não por box-shadow
  - Sombras — Uso Restrito: apenas em focus ring, tooltips e modais (funcional, não decorativo)

# Padrões de Conteúdo

Baseado obrigatoriamente no Copy.txt:

* **Tom de voz**: 
  - Direto, amigável, informativo
  - Verbos de ação claros ("Descubra", "Explore", "Grave", "Publique", "Crie")
  - Linguagem contemporânea e tecnológica
  - Uso de emojis contextuais quando apropriado (🔥 para Meet/Hypar)

* **Terminologia oficial**:
  - "Cloud" (não "sala", "grupo", "canal") - unidade básica de conversa
  - "Hypar" (não "curtir", "like") - reação específica da plataforma
  - "Meet" (não "ranking", "leaderboard") - sistema de ranking de perfis
  - "Messages" (não "chat", "conversas") - sistema de mensagens diretas
  - "Feed" (não "linha do tempo", "wall") - página principal de descoberta
  - "AO VIVO" (não "live", "em transmissão") - indicador de conteúdo em tempo real
  - Categorias oficiais: For You, Trending, Drama, Funny, Sports, Real Life, Pop, Politics, Tech, Gaming, Music, Movies, Memes

* **Mensagens obrigatórias** (exatamente como especificado, sem alteração):
  - Header/Barra de Navegação:
    - Links principais: Home | Messages | Meet
    - Ícones de ação: Busca | Publicar | Notificações | Configurações
    - Logo + nome "Clouds Community" (canto esquerdo)
    - Avatar do usuário logado (canto direito)

  - Página 1 — Feed (Home):
    - Seção: Cabeçalho do Feed
      - Label "FEED" em destaque colorido
      - Título principal: "Descubra conversas acontecendo agora."
      - Subtítulo: "Explore topics quentes, navegue por categorias e seja o primeiro a iniciar uma conversa."
    - Seção: Filtros de Categoria
      - Filtros em formato de pills/tags coloridas: For You | Trending | Drama | Funny | Sports | Real Life | Pop | Politics | Tech | Gaming | Music | Movies | Memes | ...
      - Navegação horizontal com botão de avanço (">")
    - Seção: Lista de Clouds Ativas
      - Cada card exibe: badge de categoria, título da cloud, tempo restante ("AO VIVO" + timer), avatares dos participantes, contador de pessoas online, preview de conteúdo (texto ou player de áudio), botões de ação (Compartilhar, Hypar, Entrar na conversa)
      - Estado vazio:
        - Ícone de cloud
        - Título: "Nenhuma Cloud ativa"
        - Mensagem: "Está muito quieto por aqui. Seja o primeiro a iniciar uma conversa!"
    - Botões flutuantes (lateral direita):
      - Ação rápida: criar cloud | listar clouds | gravar áudio

  - Página 2 — Criar Cloud (Texto):
    - Seção: Cabeçalho da Página
      - Label "CREATE"
      - Título: "Start a new Cloud"
      - Descrição: "Write 2–4 quick messages, choose a category and lifetime, and publish a cloud that disappears when the time ends."
      - Botão: "Back to feed"
    - Seção: Formulário de Criação
      - Campo: Cloud title (placeholder: "A short, chat-style conversation title")
      - Seletor: Category (dropdown — ex: Trending)
      - Seletor: Duration (botões: 05 min | 10 min | 30 min | 1h | 24h)
      - Campo: Initial messages (Message 1, Message 2 + botão "Add line")
      - Botão de envio: "Publish cloud"
    - Seção: Preview (ao vivo)
      - Visualização em tempo real do card que será publicado no feed
      - Exibe: título, categoria, tempo de duração, mensagens iniciais

  - Página 3 — Criar Cloud (Áudio):
    - Seção: Cabeçalho da Página
      - Label "CREATE"
      - Título: "Gravar Áudio no Feed"
      - Descrição: "Grave um áudio que será publicado como uma Cloud no feed. Os ouvintes poderão participar da conversa."
      - Botão: "Back to feed"
    - Seção: Formulário de Gravação
      - Seletor: Category (dropdown)
      - Seletor: Duration (botões: 05 min | 10 min | 30 min | 1h | 24h)
      - Controle de gravação: botão de gravar (record button)
      - Botão de envio: "Publicar áudio no feed"
    - Seção: Preview (ao vivo)
      - Visualização do card de áudio que será publicado
      - Exibe: título placeholder, categoria, duração, instrução para gravar

  - Página 4 — Criar Enquete
    - Seção: Cabeçalho da Página
      - Label "NOVA ENQUETE"
      - Título: "Criar enquete"
      - Descrição: "Publique uma enquete no feed. Outros usuários poderão votar e comentar."
      - Botão: "Voltar"
    - Seção: Formulário da Enquete
      - Campo: Pergunta da enquete (max. 120 caracteres, com contador)
      - Campo: Opções (mínimo 2, máximo 6; identificadas por letras A, B, C...)
      - Botão "+ Adicionar" para incluir mais opções
      - Botão "×" para remover opções
    - Seletor: Categoria (dropdown)
    - Seletor: Duração (botões: 05 min | 10 min | 30 min | 1h | 24h)
    - Seção: Preview
      - Visualização em tempo real da enquete publicada no feed

  - Página 5 — Meet (Ranking):
    - Seção: Cabeçalho do Meet
      - Label "RANKING"
      - Título: "Meet 🔥"
      - Descrição: "Os perfis mais hypados da plataforma. Quanto mais hypes recebidos, maior o posto no ranking."
      - Contador: N perfis ativos
    - Seção: Filtros de Região
      - Pills de filtro: Todas as regiões | Norte | Nordeste | Centro-Oeste | Sudeste | Sul
      - Campo de busca: "Buscar perfil..."
    - Seção: Top 3 Hypados (Pódio)
      - Exibição em formato de pódio (1º lugar no centro, 2º à esquerda, 3º à direita)
      - Cada posição exibe: avatar, nome, quantidade de hypes, número da posição
      - Botões: "Ver perfil" | "Seguir"
    - Seção: Lista de Ranking (4º em diante)
      - Lista ordenada com: posição, avatar, nome, cargo/descrição, quantidade de hypes, botões "Ver perfil" e "Seguir"

  - Página 6 — Messages (Mensagens Diretas):
    - Seção: Painel Lateral — Lista de Conversas
      - Label "Mensagens" + botão "+" para nova conversa
      - Campo de busca: "Buscar..."
      - Lista de conversas com: avatar, nome do contato, status online (indicador verde), prévia da última mensagem, timestamp, contador de mensagens não lidas
    - Seção: Área Principal — Conversa Aberta
      - Cabeçalho do chat: nome do contato, status ("online"), ícones de busca, perfil e mais opções
      - Histórico de mensagens: agrupado por data (ex: "02 de junho de 2026", "Hoje"), com avatares, nomes e horários
      - Suporte a diferentes tipos de mensagem: texto, emoji, imagem, áudio (player inline), link de cloud compartilhada
      - Campo de input: "Mensagem..." + botão de emoji + botão de áudio

  - Página 7 — Configurações (Preferências):
    - Seção: Cabeçalho da Página
      - Label "CONFIGURAÇÕES"
      - Título: "Preferências"
      - Avatar do usuário
    - Seção: Menu Lateral de Navegação
      - Conta (Email, nome, sessão)
      - Perfil (Foto, bio, região)
      - Privacidade (Visibilidade, bloqueios)
      - Notificações (Alertas e canais)
      - Aparência (Tema, cores, texto)
      - Acessibilidade (Contraste, atalhos)
      - Segurança (Senha, 2FA)
      - Dados (Export, exclusão)
      - Sobre (App, legal, suporte)
    - Seção: Painel de Conteúdo — Conta (exemplo)
      - Sub-seção "Informações":
        - Campo: Nome
        - Campo: Email
        - Campo: Telefone
        - Botão: "Salvar"
      - Sub-seção "Detalhes":
        - ID da conta
        - Membro desde (data)
        - Clouds criadas (contador)
        - Status da conta
      - Sub-seção "Sessão":
        - Botão: "Sair da conta"

  - Componentes Reutilizáveis:
    - Card de Cloud — usado no Feed e nos previews de criação
    - Player de Áudio — usado no Feed e no chat de mensagens
    - Pills de Categoria — usadas no Feed, criação de cloud, criação de enquete
    - Seletor de Duração — usado em criação de cloud, áudio e enquete
    - Avatar com inicial — usado em todo o sistema
    - Badge "AO VIVO" — indicador de conteúdo em tempo real
    - Botão Hypar — ação de reação/curtida da plataforma

# Checklist Antes de Alterar Qualquer Coisa

Antes de qualquer modificação verificar:
- [ ] Ler PROJECT_MEMORY.md
- [ ] Ler Design System.txt (assets/Design System.txt)
- [ ] Ler Copy.txt (assets/Copy.txt)
- [ ] Verificar impacto nas rotas (adicionar/remover/modificar páginas)
- [ ] Verificar impacto nos componentes compartilhados (alterações que afetam múltiplas páginas)
- [ ] Verificar impacto na responsividade (testar em diferentes tamanhos de tela)
- [ ] Verificar impacto em SEO (tags meta, estrutura semântica)
- [ ] Verificar impacto em acessibilidade (contraste, navegação por teclado, aria-labels)
- [ ] Verificar impacto em autenticação (se aplicável)
- [ ] Verificar impacto em APIs (se aplicável)
- [ ] Verificar se alterações estão conforme as especificações exatas do Copy.txt
- [ ] Verificar se alterações seguem exatamente o Design System.txt (cores, tipografia, espaçamentos)
- [ ] Verificar se não há conflations com componentes existentes
- [ ] Verificar se o cambio não quebra a consistência visual do sistema

# Checklist Após Cada Alteração

Executar obrigatoriamente:
```bash
npm run dev
```

Verificar:
- [ ] Erros de compilação (terminal deve mostrar "✓ Ready in Xms" sem erros)
- [ ] Warnings (resolver warnings relevantes, especialmente aqueles que podem indicar problemas futuros)
- [ ] Console do navegador (nenhum erro vermelho ou amarelo inesperado)
- [ ] Rotas afetadas (navegar por todas as rotas modificadas ou relacionadas)
- [ ] Componentes afetados (testar componentes modificados em diferentes contextos)
- [ ] Responsividade (testar em mobile, tablet e desktop)
- [ ] Funcionalidades relacionadas (verificar se mudanças não quebraram funcionalidades conectadas)
- [ ] Estado de loading e tratamento de erro (se aplicável à alteração)
- [ ] Acessibilidade específica alterada (se a mudança afetou elementos de acessibilidade)

# Alterações Recentes

Data: 2026-06-10
Alteração: Implementação completa da plataforma Clouds Community seguindo Copy.txt e Design System.txt
Motivo: Criar uma plataforma completa conforme especificações fornecidas
Arquivos: 
- Criados todos os componentes e páginas em src/
- Modificados next.config.ts para habilitar app directory
- Criado tailwind.config.ts com configuração do Design System
- Criado src/app/globals.css com variáveis CSS do Design System
- Criado página inicial (src/app/page.tsx) - Feed
- Criado página de criação de cloud de texto (src/app/create/text/page.tsx)
- Criado página de criação de cloud de áudio (src/app/create/audio/page.tsx)
- Criado página de criação de enquete (src/app/create/poll/page.tsx)
- Criado página de meet/ranking (src/app/meet/page.tsx)
- Criado página de messages/mensagens diretas (src/app/messages/page.tsx)
- Criado página de settings/configurações (src/app/settings/page.tsx)
- Criado todos os componentes reutilizáveis necessários
Resultado: Plataforma completa implementada com todas as funcionalidades especificadas, seguindo rigorosamente o Design System e Copy.txt

Data: 2026-06-10 (continuação)
Alteração: Correção de problemas de execução identificados durante testes
Motivo: Resolver erros que impediam a execução correta do projeto
Arquivos:
- src/app/globals.css (removido border-border inválido, corrigido uso de variáveis CSS)
- src/app/layout.tsx (corrigido carregamento de fontes, removido next/font/google incompatível)
- src/app/page.tsx (corrigido sintaxe JSX, corrigido imports de componentes, removido var(--*) indevido)
- src/app/layout.tsx (correção de exportação de componentes)
- Muitos componentes em src/components/ (corrigido referências a var(--*) para usar classes diretas)
- Remoção de C:\Users\segan\package-lock.json (lockfile incorreto causando warning)
Resultado: Projecto agora compila e executa sem erros, todas as páginas acessíveis e funcionando conforme especificado

Data: 2026-06-11
Alteração: Criação de Dockerfile e docker-compose.yml para containerização
Motivo: Resolver problemas de dependência e ambiente, preparar para integração futura com backend
Arquivos:
- Criado Dockerfile com Node.js 20-alpine (compatível com todas as dependências)
- Criado .dockerignore para otimizar builds
- Criado docker-compose.yml com serviço frontend pronto para receber backend no futuro
Resultado: Ambiente de desenvolvimento isolado e reprodutível que elimina problemas "funciona na minha máquina"

Data: 2026-06-11
Alteração: Correção final de problemas de CSS no globals.css
Motivo: Resolver erros de parsing CSS durante o build do Tailwind
Arquivos:
- src/app/globals.txt (reescrito completamente para remover seletores CSS inválidos que estavam causando falhas no build)
Resultado: Aplicação compila e executa sem erros de CSS, mantendo conformidade com o Design System

Data: 2026-06-11
Alteração: Criação/atualização deste arquivo PROJECT_MEMORY.md
Motivo: Documentar decisões, problemas solucionados e padrões estabelecidos para referência futura
Arquivos: Criado PROJECT_MEMORY.md na raiz do projeto
Resultado: Base de conhecimento interna do projeto estabelecida para facilitar manutenção e desenvolvimento futuro
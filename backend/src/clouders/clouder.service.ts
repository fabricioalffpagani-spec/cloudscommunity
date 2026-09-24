import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { CloudMemberRole, CloudMode, CloudStatus, CloudVisibility } from '@prisma/client';
import { createPasswordHash } from '../auth/auth.utils';
import { CloudTopicClassifierService } from '../clouds/topic-classification/cloud-topic-classifier.service';
import { DirectMessagesGateway } from '../direct-messages/direct-messages.gateway';
import { DirectMessagesService } from '../direct-messages/direct-messages.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

const BATCH_ID = 'clouder-seed-2026-09';
const CYCLE_MS = 60 * 60 * 1000;
const INTERACTION_PULSE_MS = 12 * 1000;
const CLOUDERS_PER_CYCLE = 10;
const CLOUDS_PER_CLOUDER = 1;
const CLOUDER_AVATARS = [
  ...Array.from({ length: 15 }, (_, index) => `/clouder-avatars/female-${String(index + 1).padStart(2, '0')}.png`),
  ...Array.from({ length: 5 }, (_, index) => `/clouder-avatars/male-${String(index + 1).padStart(2, '0')}.png`),
  ...Array.from({ length: 5 }, (_, index) => `/clouder-avatars/clouder-${String(index + 1).padStart(2, '0')}.png`),
  ...Array.from({ length: 5 }, (_, index) => `/clouder-avatars/generated-${String(index + 1).padStart(2, '0')}.png`),
] as const;

type TopicId =
  | 'musica' | 'filmes_series' | 'games' | 'esportes' | 'tecnologia'
  | 'relacionamentos' | 'humor_internet' | 'livros_cultura' | 'atualidades' | 'politica_sociedade';

const CLOUD_TITLE_VOICE: Record<TopicId, string[]> = {
  musica: [
    'O álbum da Liniker cresceu MUITO depois da terceira ouvida',
    'Setlist perfeito não existe (mas esse show quase chegou lá) kkk',
    'Disco curtinho demais virou regra e eu me recuso a aceitar',
    'Um disco brasileiro pra converter o amigo do indie gringo',
    'Fone caro ajuda, mas não faz milagre — pronto, falei',
    'Músicas que mudam de sentido quando você ouve a letra de vdd',
  ],
  filmes_series: [
    'O final de Succession continua doendo e isso é um elogio',
    'Terror sem jumpscare é bem mais assustador, sim',
    'Série de uma temporada: quando parar cedo foi a melhor decisão',
    'A dublagem de anime muda o personagem mais do que parece',
    'Remake só pra “atualizar” o original? aí não, né kkk',
    'Uma cena ótima salvando um filme meio bagunçado',
  ],
  games: [
    'GTA VI nem precisa reinventar tudo — só deixa a cidade respirar',
    'Jogo coop fica melhor quando todo mundo é ruim junto kkk',
    'Baldur’s Gate 3 sem saber D&D: dá pra ir sem medo?',
    'Skin bonita é legal, loja em todo menu já cansou',
    'Clássico de PS2 que ainda aguenta um replay hoje',
    'Ranked é divertido até virar segundo emprego',
  ],
  esportes: [
    'O calendário do futebol brasileiro tá puxado demais, sério',
    'Volante bom some da estatística e aparece no jogo inteiro',
    'F1 sem chuva ainda pode ser boa — a estratégia que lute',
    'O VAR acertou mais, mas roubou metade do grito de gol',
    'Atleta brasileiro fora do futebol que merece muito mais hype',
    'Torcer em fase ruim é um esporte dentro do esporte',
  ],
  tecnologia: [
    'IA que economiza tempo de verdade, sem criar retrabalho depois',
    'Trocar de celular todo ano? pra mim já não cola',
    'Todo app simples virou assinatura e isso saiu do controle',
    'Permissão de app que eu nunca aceito: localização pra tudo',
    'Notebook leve ou desktop montado: escolha difícil pra quem programa',
    'IA deveria admitir “não sei” com mais frequência, sim',
  ],
  relacionamentos: [
    'Amizade que esfriou merece conversa ou só espaço?',
    'Pedir espaço não é a mesma coisa que sumir, né gente',
    'Presente útil ou rolê junto: eu já tenho meu lado nessa kkk',
    'Dá pra ser amigo de ex, mas não é um botão de liga/desliga',
    'Recusar convite sem inventar desculpa virou uma habilidade adulta',
    'Nem toda diferença de comunicação é red flag — calma',
  ],
  humor_internet: [
    'Meme bom não precisa humilhar ninguém pra funcionar',
    'Toda trend do TikTok dura 3 dias e eu tenho provas kkk',
    'Vídeo curto deixou até contar piada mais acelerado',
    'Bordão de comentário que já pode se aposentar, por favor',
    'Influencer não precisa opinar sobre TUDO, tá tudo bem',
    'O algoritmo me jogou num nicho tão específico que aceitei meu destino',
  ],
  livros_cultura: [
    'Livro curto pra convencer quem diz que não consegue ler',
    'Machado de Assis fica muito mais divertido fora da escola',
    'Clube do livro sem virar meta de academia, por favor',
    'Adaptação fiel demais às vezes perde a graça, eu acho',
    'Arte precisa de explicação ou dá pra só sentir primeiro?',
    'Autor que eu demorei pra gostar e hoje indico pra todo mundo',
  ],
  atualidades: [
    'Notícia em andamento pede calma — o “urgente” nem sempre ajuda',
    'Clima extremo já mudou a rotina da sua cidade?',
    'Dólar sobe e a rotina sente antes do jornal explicar',
    'Pesquisa científica sem contexto vira só manchete bonita',
    'Notificação urgente informa ou só aumenta a ansiedade?',
    'Assunto atual que merece bem mais nuance do que cabe num post',
  ],
  politica_sociedade: [
    'Regra pra redes sociais não pode virar só guerra de slogan',
    'Ônibus grátis no domingo muda bem mais que o passeio',
    'Audiência pública sem gente comum ouvindo? algo tá errado',
    'Segurança no bairro é mais que policiamento — e muito mais complexa',
    'Falar de imposto sem torcida organizada devia ser possível',
    'Conselho de bairro ainda funciona ou virou reunião vazia?',
  ],
};

const PROVOCATIVE_SUFFIXES = [
  ' — opinião impopular?',
  ' — alguém discorda?',
  ' — vou defender essa',
  ' — sem passar pano',
  ' — pode render debate',
  ' — me convença do contrário',
] as const;

function clouderCloudTitle(topic: TopicId, promptIndex: number) {
  const base = CLOUD_TITLE_VOICE[topic][promptIndex % CLOUD_TITLE_VOICE[topic].length];
  return `${base}${PROVOCATIVE_SUFFIXES[promptIndex % PROVOCATIVE_SUFFIXES.length]}`;
}

function clouderUsername(displayName: string) {
  return displayName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}

const TOPICS: Array<{ id: TopicId; label: string; prompts: Array<{ title: string; content: string }> }> = [
  { id: 'musica', label: 'Música', prompts: [
    { title: 'O último álbum da Liniker funciona melhor na primeira ou na quinta audição?', content: 'Fui voltando em algumas faixas e a impressão mudou bastante. Qual foi a música que cresceu para você?' },
    { title: 'Setlist de show: qual música famosa você tiraria para abrir espaço?', content: 'Sempre sobra uma faixa que todo mundo espera e outra menos óbvia que faria falta. Qual seria sua troca?' },
    { title: 'Por que tantos discos de pop estão ficando tão curtos?', content: 'Singles, streaming e atenção fragmentada explicam tudo ou estamos perdendo álbuns com mais fôlego?' },
    { title: 'Qual disco brasileiro você mostraria para alguém que só escuta indie internacional?', content: 'Vale uma indicação bem específica, com uma faixa de entrada para não assustar a pessoa.' },
    { title: 'Fone caro muda mesmo a experiência de ouvir música ou é só costume?', content: 'Depois de comparar fone simples, bluetooth e um mais fechado, fiquei em dúvida sobre o que realmente importa.' },
    { title: 'Uma música que parece comum até você prestar atenção na letra', content: 'Quero montar uma playlist de faixas que ganharam outro sentido depois de ouvir com calma.' },
  ] },
  { id: 'filmes_series', label: 'Filmes & Séries', prompts: [
    { title: 'O final de Succession ficou mais triste ou mais satisfatório com o tempo?', content: 'Sem precisar escolher um “vencedor”, o que você acha que a série quis dizer nos últimos minutos?' },
    { title: 'Filmes de terror com pouco susto envelhecem melhor que os cheios de jumpscare?', content: 'Pensei nisso revendo alguns clássicos. Qual terror ainda funciona mais pela atmosfera?' },
    { title: 'Qual série de uma temporada só merecia continuar — e qual terminou na hora certa?', content: 'Tem produções que parecem interrompidas e outras que escaparam de se prolongar demais.' },
    { title: 'A dublagem muda muito a personalidade de um personagem de anime?', content: 'Vi a mesma cena em versões diferentes e o humor parecia outro. Você costuma preferir qual idioma?' },
    { title: 'Um remake precisa justificar a existência dele além de “atualizar” o original?', content: 'Quais remakes trouxeram uma leitura nova e quais só repetiram a fórmula?' },
    { title: 'Qual cena de filme você defenderia mesmo que o resto do longa não seja tão bom?', content: 'Às vezes uma única sequência fica na memória por anos. Qual é a sua?' },
  ] },
  { id: 'games', label: 'Games', prompts: [
    { title: 'GTA VI precisa inovar muito ou só entregar uma cidade viva já basta?', content: 'A expectativa está tão alta que fico pensando qual detalhe realmente faria diferença na experiência.' },
    { title: 'Jogo cooperativo é melhor quando os amigos são ruins juntos?', content: 'As partidas mais engraçadas quase nunca são as mais competitivas. Qual jogo rende esse caos bom?' },
    { title: 'Vale começar Baldur’s Gate 3 sem conhecer D&D?', content: 'Quero saber se a curva inicial assusta ou se o jogo ensina bem para quem nunca tocou RPG de mesa.' },
    { title: 'Skins em jogos online: personalização divertida ou loja que tomou espaço demais?', content: 'Não sou contra cosmético, mas em alguns jogos parece que tudo gira em torno dele.' },
    { title: 'Qual jogo de PS2 você rejogaria hoje sem medo de estragar a memória?', content: 'Nem todo clássico passa bem pelo tempo. Qual ainda é gostoso de jogar de verdade?' },
    { title: 'Ranking competitivo melhora um multiplayer ou deixa tudo estressante?', content: 'Quero recomendações de jogos em que dá para jogar sério sem transformar cada partida em trabalho.' },
  ] },
  { id: 'esportes', label: 'Esportes', prompts: [
    { title: 'O calendário do futebol brasileiro está punindo mais os jogadores ou os torcedores?', content: 'Entre viagens, estaduais e mata-mata, parece difícil acompanhar tudo sem a qualidade cair.' },
    { title: 'Qual posição de futebol é mais difícil de avaliar sem olhar só estatística?', content: 'Acho que volante e lateral sofrem bastante nisso. Que critério você usa para analisar?' },
    { title: 'Fórmula 1 precisa de mais chuva para ficar interessante ou isso é exagero?', content: 'Em pista seca, estratégia ainda é suficiente para prender sua atenção?' },
    { title: 'O VAR melhorou as decisões, mas piorou a comemoração do gol?', content: 'Queria ouvir de quem acompanha estádio e televisão: a sensação mudou para você?' },
    { title: 'Qual atleta brasileiro fora do futebol merece muito mais conversa?', content: 'Pode ser de vôlei, skate, tênis, atletismo ou qualquer outro esporte. Quero conhecer histórias.' },
    { title: 'Torcer por um time em fase ruim muda a relação com o esporte?', content: 'Nem todo mundo vive título todo ano. O que faz alguém continuar acompanhando?' },
  ] },
  { id: 'tecnologia', label: 'Tecnologia', prompts: [
    { title: 'IA no trabalho: qual tarefa ela realmente economizou tempo sem criar retrabalho?', content: 'Quero exemplos concretos, não só promessas. Em que situação ela funcionou para você?' },
    { title: 'Trocar de celular todo ano ainda faz sentido para quem só usa câmera e WhatsApp?', content: 'As melhorias recentes parecem pequenas. O que realmente te faria trocar de aparelho?' },
    { title: 'Por que tantos aplicativos simples viraram assinaturas mensais?', content: 'Entendo manutenção, mas às vezes até lista de tarefas ganha plano premium. Onde é justo cobrar?' },
    { title: 'Privacidade digital: qual permissão de aplicativo mais incomoda você?', content: 'Localização, microfone, contatos ou notificações? Quero comparar limites que cada pessoa coloca.' },
    { title: 'Notebook leve ou desktop montado: o que vale mais para estudar programação?', content: 'Pensando em orçamento limitado e em não passar raiva com ferramentas básicas.' },
    { title: 'Assistente de IA deveria avisar quando está pouco confiante?', content: 'Isso deixaria a ferramenta mais honesta ou só tornaria a conversa menos útil?' },
  ] },
  { id: 'relacionamentos', label: 'Relacionamentos', prompts: [
    { title: 'Quando uma amizade esfria, vale perguntar diretamente o que aconteceu?', content: 'Nem sempre houve briga; às vezes a rotina só engole tudo. Como você lida sem cobrar demais?' },
    { title: 'Qual é a diferença entre pedir espaço e sumir de alguém?', content: 'Parece simples, mas uma conversa curta pode mudar completamente como a outra pessoa recebe isso.' },
    { title: 'Presentes úteis ou experiências juntos: o que faz mais sentido num aniversário?', content: 'Quero ideias para alguém que não gosta de acumular coisas, mas valoriza atenção.' },
    { title: 'Dá para manter amizade depois de um término sem fingir que nada aconteceu?', content: 'Não procuro regra universal, só experiências de quem encontrou um jeito respeitoso de lidar.' },
    { title: 'Como recusar um convite sem parecer que você não gosta da pessoa?', content: 'Às vezes falta energia, dinheiro ou tempo, e explicar tudo também cansa. Como vocês fazem?' },
    { title: 'Red flag ou só estilo de comunicação diferente?', content: 'Em que ponto uma diferença de hábito deixa de ser ajuste e começa a machucar?' },
  ] },
  { id: 'humor_internet', label: 'Humor & Internet', prompts: [
    { title: 'Qual meme recente foi engraçado sem depender de humilhar alguém?', content: 'Parece que esse tipo dura mais. Quero exemplos de humor de internet que vocês realmente gostam.' },
    { title: 'Por que toda trend do TikTok parece cansar em três dias?', content: 'É excesso de repetição, algoritmo ou a sensação de que todo mundo precisa participar?' },
    { title: 'Vídeo curto está mudando a forma como a gente conta histórias engraçadas?', content: 'Até piada parece precisar de corte rápido e legenda enorme. Isso melhorou ou piorou?' },
    { title: 'Qual bordão da internet você já não aguenta mais ver em comentário?', content: 'Pode ser uma opinião impopular — só não vale atacar quem ainda usa.' },
    { title: 'Influencer precisa opinar sobre tudo para continuar relevante?', content: 'Existe espaço para alguém produzir conteúdo bom sem entrar em toda discussão do dia?' },
    { title: 'O algoritmo já te mostrou um nicho tão específico que você ficou preso nele?', content: 'Quero saber qual foi a toca de coelho mais inesperada que apareceu no seu feed.' },
  ] },
  { id: 'livros_cultura', label: 'Livros & Cultura', prompts: [
    { title: 'Qual livro curto você daria para alguém que diz não ter paciência para ler?', content: 'Pode ser romance, conto ou não ficção — mas precisa ter uma porta de entrada boa.' },
    { title: 'Machado de Assis é mais divertido quando a leitura deixa de ser “obrigação escolar”?', content: 'Quem releu depois de adulto percebeu algo que tinha passado batido?' },
    { title: 'Clube do livro funciona melhor com meta mensal ou leitura sem prazo?', content: 'Estou pensando em participar de um e queria entender como evitar que vire uma cobrança.' },
    { title: 'Adaptação de livro para cinema deve ser fiel ou encontrar uma linguagem própria?', content: 'Quais adaptações mudaram bastante, mas ainda capturaram o espírito da obra?' },
    { title: 'Uma exposição de arte precisa de explicação para ser apreciada?', content: 'Às vezes a mediação ajuda muito; outras parece que tira espaço da experiência. O que vocês acham?' },
    { title: 'Qual autor você demorou para gostar, mas hoje recomenda?', content: 'Quero descobrir leituras que pedem insistência e acabam compensando.' },
  ] },
  { id: 'atualidades', label: 'Atualidades', prompts: [
    { title: 'Como acompanhar uma notícia em desenvolvimento sem cair em informação pela metade?', content: 'Entre alerta, vídeo curto e manchete, qual fonte ou hábito ajuda você a esperar confirmação?' },
    { title: 'Eventos climáticos extremos já mudaram algum plano da sua cidade?', content: 'Quero falar de impactos concretos no cotidiano, sem transformar a conversa em disputa.' },
    { title: 'A alta do dólar chega em que parte da rotina antes de todo mundo perceber?', content: 'Produtos importados, viagem, comida, trabalho: onde você sente primeiro?' },
    { title: 'O que uma pesquisa científica precisa explicar para não parecer só manchete?', content: 'Método, limite, amostra? Sinto que muita notícia perde contexto no caminho.' },
    { title: 'Notificação urgente ajuda a informar ou só aumenta ansiedade?', content: 'Quais assuntos merecem alerta imediato e quais poderiam esperar um resumo melhor?' },
    { title: 'Qual assunto atual merece mais nuance do que cabe em um post?', content: 'Quero sugestões para ler e entender melhor sem decidir tudo em cinco minutos.' },
  ] },
  { id: 'politica_sociedade', label: 'Política & Sociedade', prompts: [
    { title: 'Projeto de lei sobre redes sociais: onde deveria estar o limite entre regra e censura?', content: 'Quero discutir critérios práticos para plataformas, usuários e autoridades, sem reduzir o tema a slogans.' },
    { title: 'Transporte público gratuito aos domingos muda de verdade a vida na cidade?', content: 'Além do lazer, que impactos isso pode ter para trabalho, família e acesso a serviços?' },
    { title: 'Por que uma audiência pública costuma ouvir tão pouca gente fora do setor interessado?', content: 'O formato poderia ser mais acessível para quem é afetado por uma decisão?' },
    { title: 'Segurança no bairro: iluminação, moradia e policiamento deveriam entrar na mesma conversa?', content: 'Às vezes a solução parece tratada como uma coisa só, mas a experiência de quem vive ali é mais ampla.' },
    { title: 'Como falar de imposto sem transformar a conversa em torcida?', content: 'O que ajudaria a discutir serviço público, renda e transparência com mais honestidade?' },
    { title: 'Conselhos de bairro ainda são uma forma útil de participação?', content: 'Quem já acompanhou algum: o que funciona e o que afasta as pessoas?' },
  ] },
];

const RESPONSES: Record<TopicId, string[]> = {
  musica: ['sim! essa faixa me pegou depois de umas ouvidas', 'boa lembrança, vou colocar na fila aqui kkk'],
  filmes_series: ['concordo, a história vai ficando melhor depois', 'anotei pra ver. sua defesa vendeu bem rs'],
  games: ['eu jogaria só pelas histórias com os amigos mesmo kkk', 'faz sentido demais, esse tipo de jogo rende'],
  esportes: ['boa leitura do momento. o contexto muda tudo', 'também reparei nisso, não é tão simples assim'],
  tecnologia: ['uso parecido por aqui, quando funciona poupa tempo msm', 'é isso. tech boa resolve algo concreto'],
  relacionamentos: ['gostei desse jeito de olhar pra situação', 'é simples mas muda bastante no dia a dia'],
  humor_internet: ['eu ri mas entendo totalmente o ponto kkk', 'a internet exagera, mas essa conversa é boa'],
  livros_cultura: ['anotei a indicação! parece bem minha cara', 'essa obra fica na cabeça por um tempão mesmo'],
  atualidades: ['vale acompanhar com calma antes de fechar opinião', 'sim, esse assunto pede menos pressa'],
  politica_sociedade: ['ouvir vivências diferentes melhora muito a conversa', 'boa provocação. dá pra discordar sem tretar'],
};

function contextualResponse(topic: TopicId, message: string, turn: number) {
  const normalized = message.replace(/\s+/g, ' ').trim();
  const words: string[] = normalized.match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  const ignoredWords: string[] = ['porque', 'tambem', 'muito', 'sobre', 'quando', 'entao', 'acho', 'seria'];
  const focus = words.find((word) => !ignoredWords.includes(word.toLocaleLowerCase('pt-BR')));
  const followUps = [
    focus ? `Você tocou em “${focus}”, e eu acho que esse é o ponto que muda a conversa.` : 'Você trouxe um ponto que merece ir além do óbvio.',
    'Tem um contraexemplo que faria você rever essa opinião?',
    'Concordo em parte, mas acho que o contexto pesa bastante aqui.',
    'Boa. Quem discorda, qual seria o argumento mais forte?',
  ];
  return `${followUps[turn % followUps.length]} ${RESPONSES[topic][turn % RESPONSES[topic].length]}`;
}

function directMessageResponse(message: string, turn: number) {
  const asksAboutAutomation = /\b(bot|rob[oô]|automatizad[oa]|ia|intelig[eê]ncia artificial)\b/i.test(message);
  if (asksAboutAutomation) {
    return 'Sim — sou um Clouder automatizado da Clouds Community. Fui criado para participar das conversas e responder por aqui, mas sempre deixo isso claro quando me perguntam diretamente.';
  }
  const words: string[] = message.match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  const focus = words.find((word) => !['porque', 'tambem', 'muito', 'sobre', 'quando', 'entao'].includes(word.toLocaleLowerCase('pt-BR')));
  const replies = [
    focus ? `Vi o que você falou sobre “${focus}”. Eu iria por esse caminho também — o que te fez chegar nisso?` : 'Li sua mensagem. Me conta um pouco mais do seu ponto de vista?',
    'Boa provocação. Acho que o contexto muda bastante a resposta; qual parte pesa mais para você?',
    'Faz sentido. Não tenho uma resposta fechada, mas gostei de como você colocou a questão.',
    'Concordo em parte. Se você quiser, a gente pode destrinchar isso por aqui.',
  ];
  return replies[turn % replies.length];
}

const CLOUDERS: Array<{ name: string; gender: 'female' | 'male' }> = [
  ...['Aline Costa', 'Camila Reis', 'Elisa Moraes', 'Giovana Alves', 'Isabela Torres', 'Karina Melo', 'Marina Freitas', 'Olivia Ramos', 'Queila Martins', 'Sofia Cardoso', 'Ursula Vieira', 'Yasmin Duarte', 'Amanda Neri', 'Daniele Paes', 'Flavia Cruz', 'Gabi Leal', 'Iara Peixoto', 'Kelly França', 'Malu Neves', 'Paula Siqueira', 'Sara Bastos', 'Valentina Luz', 'Yara Falcão', 'Zilda Monteiro', 'Bia Amaral'].map((name) => ({ name, gender: 'female' as const })),
  ...['Bruno Nunes', 'Diego Lima', 'Felipe Rocha', 'Henrique Dias', 'João Viana', 'Lucas Azevedo', 'Nicolas Barros', 'Paulo Tavares', 'Rafa Campos', 'Tiago Lopes', 'Vitor Farias', 'Wesley Andrade', 'Zeca Pires', 'Caio Brito', 'Enzo Prado', 'Heitor Salles', 'Jonas Mota', 'Leandro Moura', 'Nando Coelho', 'Rian Teixeira', 'Theo Rezende', 'Will Costa', 'Xavier Nobre', 'Arthur Sena', 'Ciro Valente'].map((name) => ({ name, gender: 'male' as const })),
];

@Injectable()
export class ClouderService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ClouderService.name);
  private timer: NodeJS.Timeout | null = null;
  private interactionTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly topicClassifier: CloudTopicClassifierService,
    private readonly directMessagesService: DirectMessagesService,
    private readonly directMessagesGateway: DirectMessagesGateway,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.CLOUDER_AUTOMATION_ENABLED === 'false') return;
    await this.ensureClouders();
    await this.refreshClouderCloudTitles();
    await this.runCurrentCycle();
    await this.backfillClouderInteractions();
    this.scheduleNextCycle();
    this.interactionTimer = setInterval(() => void this.runInteractionPulse(), INTERACTION_PULSE_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
    if (this.interactionTimer) clearInterval(this.interactionTimer);
  }

  private async ensureClouders() {
    await Promise.all(CLOUDERS.map(async ({ name: displayName }, index) => {
      const username = clouderUsername(displayName);
      const serviceEmail = `clouder${String(index + 1).padStart(2, '0')}@clouders.invalid`;
      const topic = TOPICS[index % TOPICS.length];
      // Keep the discussion participants visually human and varied. The
      // catalog is deliberately cycled so every Clouder gets a color portrait
      // rather than falling back to an initial-only placeholder.
      const avatarUrl = CLOUDER_AVATARS[index % CLOUDER_AVATARS.length];
      await this.prisma.user.upsert({
        where: { email: serviceEmail },
        create: {
          email: serviceEmail,
          passwordHash: createPasswordHash(`clouder-disabled-${index}`),
          emailVerifiedAt: new Date(),
          termsAcceptedAt: new Date(),
          communityRulesAcceptedAt: new Date(),
          isTestClouder: true,
          testClouderBatchId: BATCH_ID,
          profile: {
            create: {
              username,
              displayName,
              birthDate: new Date('1992-01-01'),
              bio: `Clouder de demonstração · ${topic.label}`,
              avatarUrl,
              interests: [topic.id],
              interestsCompletedAt: new Date(),
              isPrivate: false,
            },
          },
        },
        update: {
          isTestClouder: true,
          testClouderBatchId: BATCH_ID,
          profile: {
            upsert: {
              create: {
                username,
                displayName,
                birthDate: new Date('1992-01-01'),
                bio: `Clouder de demonstração · ${topic.label}`,
                avatarUrl,
                interests: [topic.id],
                interestsCompletedAt: new Date(),
                isPrivate: false,
              },
              update: { username, displayName, bio: `Clouder de demonstração · ${topic.label}`, avatarUrl, interests: [topic.id], isPrivate: false },
            },
          },
        },
      });
    }));
    this.logger.log(`Clouders prontos: ${CLOUDERS.length}.`);
  }

  private scheduleNextCycle() {
    const now = new Date();
    const nextHour = this.cycleStart(now).getTime() + CYCLE_MS;
    this.timer = setTimeout(async () => {
      await this.runCurrentCycle();
      this.scheduleNextCycle();
    }, Math.max(1_000, nextHour - now.getTime()));
  }

  private async refreshClouderCloudTitles() {
    const clouds = await this.prisma.cloud.findMany({
      where: { author: { isTestClouder: true, testClouderBatchId: BATCH_ID }, deletedAt: null },
      select: { id: true, category: true, title: true, content: true },
    });
    const updates = clouds.flatMap((cloud) => {
      const topic = TOPICS.find((item) => item.id === cloud.category);
      if (!topic) return [];
      const promptIndex = topic.prompts.findIndex((prompt) => prompt.content === cloud.content);
      if (promptIndex < 0) return [];
      const title = clouderCloudTitle(topic.id, promptIndex);
      return cloud.title === title ? [] : [this.prisma.cloud.update({ where: { id: cloud.id }, data: { title } })];
    });
    await Promise.all(updates);
    if (updates.length > 0) this.logger.log(`Títulos com voz mais natural aplicados a ${updates.length} Clouds de demonstração.`);
  }

  private cycleStart(now: Date) {
    return new Date(Math.floor(now.getTime() / CYCLE_MS) * CYCLE_MS);
  }

  private async runCurrentCycle() {
    if (this.running) return;
    this.running = true;
    try {
      const start = this.cycleStart(new Date());
      const cycle = Math.floor(start.getTime() / CYCLE_MS);
      const clouders = await this.prisma.user.findMany({
        where: { isTestClouder: true, testClouderBatchId: BATCH_ID, deletedAt: null },
        include: { profile: true },
        orderBy: { email: 'asc' },
      });
      if (clouders.length !== CLOUDERS.length) return;

      const selected = Array.from({ length: CLOUDERS_PER_CYCLE }, (_, offset) => clouders[(cycle * CLOUDERS_PER_CYCLE + offset) % clouders.length]);
      for (const [position, clouder] of selected.entries()) {
        const topic = TOPICS[(cycle + position) % TOPICS.length];
        const promptsForCycle = Array.from(
          { length: CLOUDS_PER_CLOUDER },
          (_, offset) => {
            const promptIndex = (cycle * CLOUDS_PER_CLOUDER + offset) % topic.prompts.length;
            return { ...topic.prompts[promptIndex], title: clouderCloudTitle(topic.id, promptIndex) };
          },
        );
        for (const prompt of promptsForCycle) {
          const alreadyCreated = await this.prisma.cloud.findFirst({ where: { authorId: clouder.id, title: prompt.title, createdAt: { gte: start } }, select: { id: true } });
          if (alreadyCreated) continue;
          const classification = this.topicClassifier.classifyCloudTopic({ title: prompt.title, description: prompt.content });
          let createdCloudId: string | null = null;
          await this.prisma.$transaction(async (tx) => {
            const cloud = await tx.cloud.create({
              data: {
                authorId: clouder.id,
                title: prompt.title,
                content: prompt.content,
                category: topic.id,
                mode: CloudMode.text,
                visibility: CloudVisibility.public,
                status: CloudStatus.active,
                duration: '2h',
                startedAt: new Date(),
                primaryTopic: classification.primaryTopic,
                topicScores: classification.topics,
                topicKeywords: classification.matchedTerms,
                topicConfidence: classification.confidence,
                classificationVersion: classification.classificationVersion,
                classifiedAt: new Date(),
              },
            });
            await tx.cloudMember.create({ data: { cloudId: cloud.id, userId: clouder.id, role: 'host' } });
            createdCloudId = cloud.id;
          });
          if (createdCloudId) {
            await this.addClouderInteractions({ id: createdCloudId, authorId: clouder.id, category: topic.id, startedAt: new Date() }, clouders);
          }
        }
      }
      this.logger.log(`Ciclo Clouder concluído: ${selected.length * CLOUDS_PER_CLOUDER} Clouds planejadas.`);
    } catch (error) {
      this.logger.error('Não foi possível executar o ciclo de Clouders.', error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }

  private async backfillClouderInteractions() {
    const clouds = await this.prisma.cloud.findMany({
      where: { author: { isTestClouder: true, testClouderBatchId: BATCH_ID }, status: CloudStatus.active, deletedAt: null },
      select: { id: true, authorId: true, category: true, startedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const clouders = await this.prisma.user.findMany({
      where: { isTestClouder: true, testClouderBatchId: BATCH_ID, deletedAt: null },
      select: { id: true },
      orderBy: { email: 'asc' },
    });
    for (const cloud of clouds) await this.addClouderInteractions(cloud, clouders);
  }

  private async runInteractionPulse() {
    if (this.running) return;
    const clouders = await this.prisma.user.findMany({
      where: { isTestClouder: true, testClouderBatchId: BATCH_ID, deletedAt: null },
      select: { id: true },
      orderBy: { email: 'asc' },
    });
    if (!clouders.length) return;
    await this.runDirectMessagePulse();
    const clouds = await this.prisma.cloud.findMany({
      where: {
        status: CloudStatus.active,
        visibility: CloudVisibility.public,
        deletedAt: null,
        messages: { some: { deletedAt: null, user: { isTestClouder: false } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, authorId: true, category: true, createdAt: true },
    });
    for (const cloud of clouds) {
      const lastBotMessage = await this.prisma.cloudMessage.findFirst({
        where: { cloudId: cloud.id, deletedAt: null, user: { isTestClouder: true } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (lastBotMessage && Date.now() - lastBotMessage.createdAt.getTime() < 20_000) continue;
      const priorBotMessages = await this.prisma.cloudMessage.count({ where: { cloudId: cloud.id, deletedAt: null, user: { isTestClouder: true } } });
      if (priorBotMessages >= 12) continue;
      const latestUserMessage = await this.prisma.cloudMessage.findFirst({
        where: { cloudId: cloud.id, deletedAt: null, user: { isTestClouder: false }, content: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true },
      });
      if (!latestUserMessage || (lastBotMessage && lastBotMessage.createdAt >= latestUserMessage.createdAt)) continue;
      const eligibleClouders = clouders.filter((clouder) => clouder.id !== cloud.authorId);
      const responder = eligibleClouders[priorBotMessages % eligibleClouders.length];
      if (!responder) continue;
      const alreadyResponded = await this.prisma.cloudMessage.findFirst({ where: { cloudId: cloud.id, userId: responder.id, deletedAt: null }, select: { id: true } });
      if (alreadyResponded) continue;
      const topic = TOPICS.find((item) => item.id === cloud.category)?.id ?? 'atualidades';
      await this.prisma.$transaction(async (tx) => {
        await tx.cloudMember.upsert({ where: { cloudId_userId: { cloudId: cloud.id, userId: responder.id } }, update: { leftAt: null }, create: { cloudId: cloud.id, userId: responder.id, role: CloudMemberRole.member } });
        await tx.cloudMessage.create({ data: { cloudId: cloud.id, userId: responder.id, type: 'text', content: contextualResponse(topic, latestUserMessage.content ?? '', priorBotMessages) } });
      });
      break;
    }
  }

  private async runDirectMessagePulse() {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        deletedAt: null,
        OR: [
          { participantOne: { isTestClouder: true, testClouderBatchId: BATCH_ID } },
          { participantTwo: { isTestClouder: true, testClouderBatchId: BATCH_ID } },
        ],
        messages: { some: { deletedAt: null, sender: { isTestClouder: false }, content: { not: null } } },
      },
      select: { id: true, participantOneId: true, participantTwoId: true, lastMessageAt: true },
      orderBy: { lastMessageAt: 'desc' },
      take: 30,
    });

    for (const conversation of conversations) {
      const clouder = await this.prisma.user.findFirst({
        where: {
          id: { in: [conversation.participantOneId, conversation.participantTwoId] },
          isTestClouder: true,
          testClouderBatchId: BATCH_ID,
        },
        select: { id: true },
      });
      if (!clouder) continue;
      const latestUserMessage = await this.prisma.directMessage.findFirst({
        where: { conversationId: conversation.id, deletedAt: null, sender: { isTestClouder: false }, content: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true },
      });
      const latestClouderMessage = await this.prisma.directMessage.findFirst({
        where: { conversationId: conversation.id, deletedAt: null, senderId: clouder.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (!latestUserMessage || (latestClouderMessage && latestClouderMessage.createdAt >= latestUserMessage.createdAt)) continue;
      const response = directMessageResponse(latestUserMessage.content ?? '', latestClouderMessage ? 1 : 0);
      const created = await this.directMessagesService.sendAutomatedTextMessage(clouder.id, conversation.id, response);
      await this.directMessagesGateway.broadcastMessageCreated(clouder.id, conversation.id, created);
      break;
    }
  }

  private async addClouderInteractions(
    cloud: { id: string; authorId: string; category: string; startedAt: Date | null },
    clouders: Array<{ id: string }>,
  ) {
    const topic = TOPICS.find((item) => item.id === cloud.category)?.id ?? 'atualidades';
    const responders = clouders.filter((item) => item.id !== cloud.authorId).slice(0, 4);
    const messages = RESPONSES[topic];
    for (const [index, responder] of responders.entries()) {
      const existing = await this.prisma.cloudMessage.findFirst({ where: { cloudId: cloud.id, userId: responder.id, deletedAt: null }, select: { id: true } });
      if (existing) continue;
      await this.prisma.$transaction(async (tx) => {
        await tx.cloudMember.upsert({
          where: { cloudId_userId: { cloudId: cloud.id, userId: responder.id } },
          update: { leftAt: null },
          create: { cloudId: cloud.id, userId: responder.id, role: CloudMemberRole.member },
        });
        await tx.cloudMessage.create({
          data: {
            cloudId: cloud.id,
            userId: responder.id,
            type: 'text',
            content: messages[index % messages.length],
            createdAt: new Date(),
          },
        });
      });
    }
  }
}

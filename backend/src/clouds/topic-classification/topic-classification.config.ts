import type { TopicId } from './topic-classification.types';

export const CLASSIFICATION_VERSION = '1.0.0';
export const MIN_TOPIC_SCORE = 2;
export const MIN_CONFIDENCE = 0.34;
export const MAX_SECONDARY_TOPICS = 3;
export const AMBIGUITY_THRESHOLD = 0.14;
export const TERM_MIN_WEIGHT = 1;

export type TopicDefinition = { publicName: string; keywords: Record<string, number> };

const terms = (weak: string[], moderate: string[], strong: string[], characteristic: string[]): Record<string, number> =>
  Object.fromEntries([...weak.map((term) => [term, 1]), ...moderate.map((term) => [term, 2]), ...strong.map((term) => [term, 3]), ...characteristic.map((term) => [term, 5])]);

/** Single source of truth for deterministic topic signals and their adjustable weights. */
export const TOPIC_DEFINITIONS: Record<TopicId, TopicDefinition> = {
  musica: {
    publicName: 'Música',
    keywords: terms(['som', 'letra', 'vocal', 'guitarra', 'rock', 'pop', 'rap', 'trap', 'funk', 'sertanejo', 'pagode', 'samba', 'mpb', 'indie', 'jazz', 'metal'], ['música', 'album', 'disco', 'cantor', 'cantora', 'banda', 'artista', 'show', 'festival', 'turne', 'playlist', 'eletronica', 'edm', 'spotify'], ['grammy', 'beatles', 'kanye', 'drake'], ['taylor swift']),
  },
  filmes_series: {
    publicName: 'Filmes & Séries',
    keywords: terms(['cena', 'trailer', 'spoiler', 'roteiro', 'diretor', 'adaptacao', 'remake', 'terror', 'comedia', 'drama', 'anime', 'documentario', 'ator', 'atriz', 'personagem'], ['filme', 'filmes', 'serie', 'series', 'episodio', 'temporada', 'estreia', 'cinema', 'streaming', 'netflix', 'hbo', 'max', 'disney'], ['marvel', 'oscar'], ['breaking bad']),
  },
  games: {
    publicName: 'Games',
    keywords: terms(['jogo', 'jogos', 'jogar', 'gamer', 'console', 'pc', 'dlc', 'multiplayer', 'ranked', 'skin', 'boss'], ['game', 'games', 'gameplay', 'playstation', 'ps5', 'xbox', 'nintendo', 'switch', 'steam', 'minecraft', 'fortnite', 'valorant', 'roblox', 'pokemon'], ['gta', 'fifa', 'league of legends', 'ea fc'], ['gta vi']),
  },
  esportes: {
    publicName: 'Esportes',
    keywords: terms(['partida', 'time', 'clube', 'jogador', 'tecnico', 'treinador', 'gol', 'campeonato', 'rodada', 'classico', 'selecao', 'volei', 'tenis', 'corrida', 'piloto', 'luta', 'torcida', 'transferencia'], ['esporte', 'futebol', 'brasileirao', 'libertadores', 'nba', 'nfl', 'ufc', 'f1', 'formula 1'], ['champions league', 'copa do mundo'], ['champions']),
  },
  tecnologia: {
    publicName: 'Tecnologia',
    keywords: { ...terms(['tech', 'celular', 'smartphone', 'android', 'samsung', 'computador', 'pc', 'notebook', 'aplicativo', 'app', 'software', 'programacao', 'codigo', 'internet', 'startup', 'inovacao', 'robo', 'algoritmo', 'dados', 'llm'], ['tecnologia', 'ia', 'ai', 'iphone', 'apple', 'microsoft', 'seguranca digital', 'machine learning'], ['chatgpt'], ['inteligencia artificial']), google: 3 },
  },
  relacionamentos: {
    publicName: 'Relacionamentos',
    keywords: terms(['amor', 'paixao', 'amizade', 'amigo', 'amiga', 'ciumes', 'termino', 'terminar', 'voltar', 'flerte', 'toxica', 'toxicos'], ['relacionamento', 'namoro', 'namorada', 'namorado', 'ficante', 'crush', 'ex', 'encontro', 'date', 'solteiro', 'solteira', 'casamento', 'casal', 'traicao', 'tinder'], ['ghosting', 'red flag', 'green flag'], ['meu ex']),
  },
  humor_internet: {
    publicName: 'Humor & Internet',
    keywords: terms(['viral', 'trend', 'trending', 'reels', 'influencer', 'youtuber', 'streamer', 'celebridade', 'treta', 'exposed', 'cancelamento', 'cringe', 'zoeira', 'flop', 'fandom'], ['meme', 'memes', 'tiktok', 'instagram', 'twitter', 'youtube'], ['rede social', 'redes sociais'], ['internet']),
  },
  livros_cultura: {
    publicName: 'Livros & Cultura',
    keywords: terms(['leitura', 'autor', 'autora', 'escritor', 'escritora', 'romance', 'literatura', 'poesia', 'poema', 'capitulo', 'classico', 'filosofia', 'arte', 'pintura', 'historia', 'cultura', 'kindle'], ['livro', 'livros', 'nobel', 'tolkien', 'shakespeare', 'salinger'], ['dostoievski', 'tolstoi'], ['machado de assis']),
  },
  atualidades: {
    publicName: 'Atualidades',
    keywords: terms(['hoje', 'agora', 'aconteceu', 'acontecendo', 'mundo', 'brasil', 'internacional', 'crise', 'economia', 'dolar', 'mercado', 'greve', 'desastre', 'guerra', 'conflito', 'descoberta', 'ciencia', 'pesquisa', 'clima', 'decisao', 'caso', 'investigacao', 'repercussao'], ['noticia', 'noticias'], ['anunciada', 'anunciado'], ['urgente']),
  },
  politica_sociedade: {
    publicName: 'Política & Sociedade',
    keywords: { ...terms(['politico', 'presidente', 'governador', 'prefeito', 'senador', 'deputado', 'congresso', 'camara', 'senado', 'ministro', 'eleicao', 'eleicoes', 'candidato', 'partido', 'votacao', 'voto', 'democracia', 'constituicao', 'lei', 'pec', 'direita', 'esquerda', 'liberal', 'conservador', 'progressista', 'imposto', 'corrupcao', 'protesto', 'manifestacao'], ['supremo', 'relacoes internacionais'], ['projeto de lei'], ['politica publica']), politica: 2, governo: 3, regulamentar: 3, stf: 4 },
  },
};

import { CloudTopicClassifierService } from './cloud-topic-classifier.service';

describe('CloudTopicClassifierService', () => {
  const classifier = new CloudTopicClassifierService();
  const classify = (title: string) => classifier.classifyCloudTopic({ title });

  it.each([
    ['Qual o melhor álbum dos Beatles?', 'musica'],
    ['Quem ganha o Brasileirão esse ano?', 'esportes'],
    ['Apple perdeu a criatividade?', 'tecnologia'],
    ['Meu ex voltou a mandar mensagem', 'relacionamentos'],
    ['Esse episódio de Breaking Bad foi absurdo', 'filmes_series'],
    ['STF tomou a decisão correta?', 'politica_sociedade'],
    ['Dostoiévski é melhor que Tolstói?', 'livros_cultura'],
    ['GTA VI vai ser adiado novamente?', 'games'],
    ['Essa trend do TikTok já ficou chata', 'humor_internet'],
  ] as const)('classifica %s como %s', (title, expectedTopic) => {
    expect(classify(title).primaryTopic).toBe(expectedTopic);
  });

  it('classifica política e tecnologia como assuntos simultâneos', () => {
    const result = classify(
      'Governo deveria regulamentar inteligência artificial?',
    );
    expect(result.primaryTopic).toBe('politica_sociedade');
    expect(result.topics.map((item) => item.topic)).toEqual(
      expect.arrayContaining(['politica_sociedade', 'tecnologia']),
    );
    expect(result.matchedTerms).toEqual(
      expect.arrayContaining([
        'governo',
        'regulamentar',
        'inteligencia artificial',
      ]),
    );
  });

  it('não cria confiança alta para um uso genérico de jogo', () => {
    const result = classify('Quem foi melhor no jogo de ontem?');
    expect(result.primaryTopic).toBeNull();
    expect(result.confidence).toBeLessThan(0.34);
  });

  it('classifica projeto de lei sobre redes sociais como política e internet', () => {
    const result = classify('Projeto de lei quer regulamentar redes sociais');
    expect(result.primaryTopic).toBe('politica_sociedade');
    expect(result.topics.map((item) => item.topic)).toEqual(
      expect.arrayContaining(['politica_sociedade', 'humor_internet']),
    );
  });

  it('aceita tecnologia e atualidades no anúncio de uma IA', () => {
    const result = classify('Nova IA da Google foi anunciada hoje');
    expect(result.primaryTopic).toBe('tecnologia');
    expect(result.topics.map((item) => item.topic)).toEqual(
      expect.arrayContaining(['tecnologia', 'atualidades']),
    );
  });

  it('permite música e filmes na mesma Cloud', () => {
    const result = classify('Taylor Swift vai aparecer em um filme?');
    expect(result.primaryTopic).toBe('musica');
    expect(result.topics.map((item) => item.topic)).toEqual(
      expect.arrayContaining(['musica', 'filmes_series']),
    );
  });

  it('normaliza acentos, caixa, hashtags e espaços sem alterar a classificação', () => {
    const result = classify('  #POLÍTICA   e  inteligência artificial  ');
    expect(result.topics.map((item) => item.topic)).toEqual(
      expect.arrayContaining(['politica_sociedade', 'tecnologia']),
    );
  });
});

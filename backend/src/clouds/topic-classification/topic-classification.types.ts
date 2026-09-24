export const TOPIC_IDS = [
  'musica',
  'filmes_series',
  'games',
  'esportes',
  'tecnologia',
  'relacionamentos',
  'humor_internet',
  'livros_cultura',
  'atualidades',
  'politica_sociedade',
] as const;

export type TopicId = (typeof TOPIC_IDS)[number];

export type ClassifiedTopic = { topic: TopicId; score: number };

export type CloudTopicClassification = {
  primaryTopic: TopicId | null;
  topics: ClassifiedTopic[];
  matchedTerms: string[];
  confidence: number;
  classificationVersion: string;
};

export type SemanticTopicClassifier = {
  classify(input: { title: string; description?: string | null; availableTopics: readonly TopicId[] }): Promise<ClassifiedTopic[]>;
};

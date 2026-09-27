import type {
  ClassifiedTopic,
  SemanticTopicClassifier,
} from './topic-classification.types';

/**
 * Extension point for embeddings, LLMs or another semantic provider.
 * The deterministic classifier deliberately remains fully functional without it.
 */
export class NoopSemanticTopicClassifier implements SemanticTopicClassifier {
  classify(): Promise<ClassifiedTopic[]> {
    return Promise.resolve([]);
  }
}

import { Injectable } from '@nestjs/common';
import {
  AMBIGUITY_THRESHOLD,
  CLASSIFICATION_VERSION,
  MAX_SECONDARY_TOPICS,
  MIN_CONFIDENCE,
  MIN_TOPIC_SCORE,
  TERM_MIN_WEIGHT,
  TOPIC_DEFINITIONS,
} from './topic-classification.config';
import { NoopSemanticTopicClassifier } from './semantic-topic-classifier.adapter';
import type {
  CloudTopicClassification,
  ClassifiedTopic,
  SemanticTopicClassifier,
  TopicId,
} from './topic-classification.types';

function normalizeForClassification(value: string | null | undefined): string {
  return (value ?? '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/#/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Local, deterministic cloud classifier. It never changes the original text or performs database work. */
@Injectable()
export class CloudTopicClassifierService {
  private readonly semanticClassifier: SemanticTopicClassifier =
    new NoopSemanticTopicClassifier();
  private readonly terms = this.buildTermsIndex();

  classifyCloudTopic(input: {
    title?: string | null;
    description?: string | null;
  }): CloudTopicClassification {
    const normalizedText = normalizeForClassification(
      `${input.title ?? ''} ${input.description ?? ''}`,
    );
    if (!normalizedText) return this.emptyClassification(0);

    const rawScores = new Map<TopicId, number>();
    const matchedTerms: string[] = [];
    const occupiedRanges: Array<{ start: number; end: number }> = [];

    for (const entry of this.terms) {
      const expression = new RegExp(
        `(^|\\s)${escapeRegExp(entry.term)}(?=\\s|$)`,
        'g',
      );
      let result: RegExpExecArray | null;
      while ((result = expression.exec(normalizedText)) !== null) {
        const leadingSpace = result[1]?.length ?? 0;
        const start = result.index + leadingSpace;
        const end = start + entry.term.length;
        if (
          occupiedRanges.some((range) => start < range.end && end > range.start)
        )
          continue;
        occupiedRanges.push({ start, end });
        matchedTerms.push(entry.term);
        entry.weights.forEach(({ topic, weight }) =>
          rawScores.set(topic, (rawScores.get(topic) ?? 0) + weight),
        );
      }
    }

    const candidates = [...rawScores.entries()]
      .filter(([, score]) => score >= MIN_TOPIC_SCORE)
      .sort(([, leftScore], [, rightScore]) => rightScore - leftScore || 0)
      .slice(0, MAX_SECONDARY_TOPICS + 1);
    if (!candidates.length)
      return this.emptyClassification(
        Math.min(
          0.25,
          [...rawScores.values()].reduce((sum, score) => sum + score, 0) * 0.12,
        ),
      );

    const total = candidates.reduce((sum, [, score]) => sum + score, 0);
    const topics: ClassifiedTopic[] = candidates.map(([topic, score]) => ({
      topic,
      score: this.round(score / total),
    }));
    const primary = topics[0];
    const primaryRawScore = candidates[0][1];
    const specificity = Math.min(1, primaryRawScore / 5);
    const ambiguityPenalty =
      topics[1] && primary.score - topics[1].score < AMBIGUITY_THRESHOLD
        ? 0.9
        : 1;
    const confidence = this.round(
      primary.score * Math.max(0.4, specificity) * ambiguityPenalty,
    );

    return {
      primaryTopic: confidence >= MIN_CONFIDENCE ? primary.topic : null,
      topics: confidence >= MIN_CONFIDENCE ? topics : [],
      matchedTerms: [...new Set(matchedTerms)],
      confidence,
      classificationVersion: CLASSIFICATION_VERSION,
    };
  }

  /** Future semantic integrations can call this when deterministic confidence is low or ambiguous. */
  async classifySemantically(input: {
    title: string;
    description?: string | null;
  }): Promise<ClassifiedTopic[]> {
    return this.semanticClassifier.classify({
      ...input,
      availableTopics: Object.keys(TOPIC_DEFINITIONS) as TopicId[],
    });
  }

  private buildTermsIndex(): Array<{
    term: string;
    weights: Array<{ topic: TopicId; weight: number }>;
  }> {
    const byTerm = new Map<string, Array<{ topic: TopicId; weight: number }>>();
    (
      Object.entries(TOPIC_DEFINITIONS) as Array<
        [TopicId, (typeof TOPIC_DEFINITIONS)[TopicId]]
      >
    ).forEach(([topic, definition]) => {
      Object.entries(definition.keywords).forEach(([term, weight]) => {
        if (weight < TERM_MIN_WEIGHT) return;
        const normalizedTerm = normalizeForClassification(term);
        if (!normalizedTerm) return;
        byTerm.set(normalizedTerm, [
          ...(byTerm.get(normalizedTerm) ?? []),
          { topic, weight },
        ]);
      });
    });
    return [...byTerm.entries()]
      .map(([term, weights]) => ({ term, weights }))
      .sort(
        (left, right) =>
          right.term.length - left.term.length ||
          Math.max(...right.weights.map((item) => item.weight)) -
            Math.max(...left.weights.map((item) => item.weight)),
      );
  }

  private emptyClassification(confidence: number): CloudTopicClassification {
    return {
      primaryTopic: null,
      topics: [],
      matchedTerms: [],
      confidence: this.round(confidence),
      classificationVersion: CLASSIFICATION_VERSION,
    };
  }

  private round(value: number) {
    return Math.round(value * 1000) / 1000;
  }
}

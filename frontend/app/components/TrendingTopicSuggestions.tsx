"use client";

import { Fragment, useEffect, useState } from "react";

type TrendingTopic = {
  id: string;
  name: string;
};

export function TrendingTopicSuggestions({
  selectedTitle,
  onSelect,
}: {
  selectedTitle: string;
  onSelect: (topic: TrendingTopic) => void;
}) {
  const [topics, setTopics] = useState<TrendingTopic[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadTopics = async () => {
      try {
        const response = await fetch("/api/clouds/trending-topics", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          ok?: boolean;
          topics?: TrendingTopic[];
        };
        if (!cancelled && payload.ok) setTopics((payload.topics ?? []).slice(0, 5));
      } catch {
        // Suggestions are optional and must never block Cloud creation.
      }
    };

    void loadTopics();
    const refresh = window.setInterval(() => void loadTopics(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, []);

  if (!topics.length) return null;

  return (
    <section aria-label="Temas em alta">
      <div className="flex min-w-0 items-center gap-3 text-[14px] leading-6 sm:text-[18px]">
        <span className="shrink-0 font-semibold text-white/75">Em alta:</span>
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 pr-1 whitespace-nowrap [scrollbar-width:none]">
          {topics.map((topic, index) => {
            const selected = selectedTitle.trim().toLocaleLowerCase("pt-BR") === topic.name.toLocaleLowerCase("pt-BR");
            return (
              <Fragment key={topic.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(topic)}
                  className={`shrink-0 text-left font-medium transition ${
                    selected
                      ? "text-[#D8B4FE] underline decoration-[#A855F7] decoration-2 underline-offset-4"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  {topic.name}
                </button>
                {index < topics.length - 1 && <span aria-hidden="true" className="shrink-0 text-white/45">•</span>}
              </Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";

const EMOJI_BANK = ["😀","🔥","❤️","😂","🙌","🎉","💬","👍","👀","✨"];

function now() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: color }}>
      {initials}
    </div>
  );
}

function SmileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
    </svg>
  );
}

function FireIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C9.5 6 8 8.5 8 11.5c0 3.75 3 6.5 4 8.5 1-2 4-4.75 4-8.5C16 8.5 14.5 6 12 2Z" />
    </svg>
  );
}

type Message = {
  id: string;
  sender: string;
  initials: string;
  color: string;
  content: string;
  time: string;
  host?: boolean;
  replyTo?: { sender: string; content: string };
  flames: number;
  reaction?: string;
};

type CloudChatProps = {
  cloudId: string;
};

const BASE_MESSAGES: Message[] = [
  {
    id: "c1",
    sender: "Beatriz",
    initials: "B",
    color: "#A855F7",
    content: "Sejam bem-vindos! Vamos discutir: IA vai substituir programadores?",
    time: "12:30",
    host: true,
    flames: 24,
  },
  {
    id: "c2",
    sender: "devmarcos",
    initials: "DM",
    color: "#22C55E",
    content: "Acho que não. A IA é uma ferramenta, não um substituto.",
    time: "12:31",
    flames: 24,
  },
  {
    id: "c3",
    sender: "anavieira",
    initials: "AV",
    color: "#3B82F6",
    content: "Depende do tipo de programação. Tarefas repetitivas sim, mas criatividade e lógica complexa não.",
    time: "12:31",
    flames: 17,
  },
  {
    id: "c4",
    sender: "lucasdev",
    initials: "LD",
    color: "#F59E0B",
    content: "Ferramentas como Copilot já aumentam muito nossa produtividade.",
    time: "12:32",
    flames: 12,
    replyTo: { sender: "anavieira", content: "Depende do tipo de programação..." },
  },
  {
    id: "c5",
    sender: "carolcode",
    initials: "CC",
    color: "#EC4899",
    content: "Concordo! E acho que o real diferencial será saber usar a IA a nosso favor.",
    time: "12:32",
    flames: 9,
  },
  {
    id: "c6",
    sender: "pedroa.dev",
    initials: "PD",
    color: "#8B5CF6",
    content: "Concordo! A IA cuida do básico e a gente foca no que realmente importa.",
    time: "12:33",
    flames: 7,
  },
];

export default function CloudChat({ cloudId }: CloudChatProps) {
  const [messages, setMessages] = useState<Message[]>(BASE_MESSAGES);
  const [draft, setDraft] = useState("");
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);

  const sendMessage = () => {
    if (!draft.trim()) return;
    setMessages(prev => [
      ...prev,
      {
        id: `own-${Date.now()}`,
        sender: "Você",
        initials: "VC",
        color: "#8B5CF6",
        content: draft.trim(),
        time: now(),
        flames: 0,
      },
    ]);
    setDraft("");
  };

  const addReaction = (messageId: string, emoji: string) => {
    setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, reaction: emoji } : msg));
    setReactionPickerFor(null);
  };

  return (
    <div className="flex h-full flex-col bg-[#070b17] text-white">
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-6 py-6">
          <div className="space-y-5">
            {messages.map(msg => (
              <div key={msg.id} className="flex items-start gap-4">
                <Avatar initials={msg.initials} color={msg.color} />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-semibold ${msg.host ? "text-[#F8FAFC]" : "text-white"}`}>{msg.sender}</p>
                    {msg.host && <span className="rounded-full border border-[#7C3AED]/40 bg-[#7C3AED]/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#C4B5FD]">Host</span>}
                    <span className="text-xs text-white/50">{msg.time}</span>
                  </div>
                  {msg.replyTo && (
                    <div className="mt-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                      <p className="font-semibold text-white">{msg.replyTo.sender}</p>
                      <p className="mt-1 leading-snug">{msg.replyTo.content}</p>
                    </div>
                  )}
                  <div className="mt-3 rounded-[28px] bg-[#111827] p-4 text-sm leading-relaxed text-white shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
                    {msg.content}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/60">
                    <button type="button" onClick={() => setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10">
                      <span>↩</span>
                      Responder
                    </button>
                    <button type="button" className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-[#F97316] transition hover:bg-white/10">
                      <FireIcon />
                      {msg.flames}
                    </button>
                    {msg.reaction && <span className="rounded-full bg-[#ffffff14] px-3 py-2 text-sm">{msg.reaction}</span>}
                  </div>
                  {reactionPickerFor === msg.id && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {EMOJI_BANK.map(emoji => (
                        <button key={emoji} type="button" onClick={() => addReaction(msg.id, emoji)}
                          className="rounded-full bg-white/5 px-3 py-2 text-sm transition hover:bg-white/10">{emoji}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#060a16] px-6 py-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Digite sua mensagem...</p>
            <p className="text-xs text-white/50">rafael, ju.dev e outras 3 pessoas estão digitando...</p>
          </div>
          <div className="flex items-center gap-2 rounded-3xl bg-white/5 px-3 py-2">
            <button type="button" className="rounded-full p-2 text-white/80 transition hover:bg-white/10">
              <SmileIcon />
            </button>
            <button type="button" className="inline-flex items-center gap-2 rounded-full bg-[#F97316] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#fb923c]">
              <FireIcon />
              Hype
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={2}
            placeholder="Escreva sua mensagem..."
            className="min-h-[72px] flex-1 resize-none rounded-3xl border border-white/10 bg-[#0b1222] px-4 py-4 text-sm text-white outline-none transition focus:border-[#7C3AED]"
          />
          <button type="button" onClick={sendMessage}
            className="inline-flex h-14 items-center justify-center rounded-3xl bg-[#7C3AED] px-6 text-sm font-semibold text-white transition hover:bg-[#6D28D9]">
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

function parseDate(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return "";
  const [, day, month, year] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  if (y < 1000 || m < 1 || m > 12 || d < 1 || d > new Date(y, m, 0).getDate()) return "";
  return `${year}-${month}-${day}`;
}

function formatDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

export function BirthDateInput({ id, value, onChange, invalid = false }: { id: string; value: string; onChange: (value: string) => void; invalid?: boolean }) {
  const [text, setText] = useState(() => value ? value.split("-").reverse().join("/") : "");
  const [touched, setTouched] = useState(false);
  const invalidDate = touched && Boolean(text) && !parseDate(text);
  return <div>
    <input id={id} type="text" inputMode="numeric" autoComplete="bday" placeholder="DD/MM/AAAA" value={text} aria-invalid={invalid || invalidDate || undefined} aria-describedby={invalidDate ? `${id}-invalid-date` : undefined} onBlur={() => setTouched(true)} onChange={(event) => { const input = event.target.value; const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input); const next = iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : formatDate(input); setText(next); onChange(parseDate(next)); }} className={`w-full rounded-2xl border bg-[#17171C] px-4 py-3 text-[15px] text-white outline-none transition focus:border-[#A855F7] ${invalid || invalidDate ? "border-red-500/70" : "border-white/[0.08]"}`} />
    {invalidDate && <p id={`${id}-invalid-date`} className="mt-2 text-[12px] text-red-300">Digite uma data válida no formato DD/MM/AAAA.</p>}
  </div>;
}

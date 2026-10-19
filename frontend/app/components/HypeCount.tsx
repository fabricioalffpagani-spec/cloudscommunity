import { FlameIcon } from "./FlameIcon";

export function HypeCount({ count }: { count: number }) {
  return (
    <span aria-label={`${count} hypes recebidos`} className="relative inline-flex h-8 min-w-8 items-center justify-center text-[#FF7A18]">
      <FlameIcon s={22} filled />
      <span aria-hidden="true" className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#7C3AED] px-1 text-[9px] font-extrabold leading-none text-white">{count}</span>
    </span>
  );
}

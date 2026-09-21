"use client";

export type CloudScope = "for-you" | "following";

export function CloudScopeTabs({
  value,
  onChange,
}: {
  value: CloudScope;
  onChange: (scope: CloudScope) => void;
}) {
  return (
    <div className="flex w-full flex-none justify-center px-4 py-1">
      <div role="tablist" aria-label="Filtrar Clouds" className="flex w-full max-w-[460px] rounded-full border border-[#37337b] bg-[#0d0b38]/70 p-0.5">
        <button
          type="button"
          role="tab"
          aria-selected={value === "for-you"}
          onClick={() => onChange("for-you")}
          className={`flex-1 rounded-full py-1.5 text-[14px] font-bold transition md:text-[15px] ${value === "for-you" ? "bg-gradient-to-r from-[#9d31f6] to-[#b13bfa] text-white shadow-[0_8px_24px_rgba(147,51,234,0.38)]" : "text-[#aaa6ef] hover:text-white"}`}
        >
          For You
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={value === "following"}
          onClick={() => onChange("following")}
          className={`flex-1 rounded-full py-1.5 text-[14px] font-bold transition md:text-[15px] ${value === "following" ? "bg-gradient-to-r from-[#9d31f6] to-[#b13bfa] text-white shadow-[0_8px_24px_rgba(147,51,234,0.38)]" : "text-[#aaa6ef] hover:text-white"}`}
        >
          Seguindo
        </button>
      </div>
    </div>
  );
}

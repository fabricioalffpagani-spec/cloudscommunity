import Image from "next/image";

export function BrandWordmark({ centered = false }: { centered?: boolean }) {
  return (
    <span className={`leading-none ${centered ? "text-center" : ""}`} aria-label="Clouds Community">
      <span className="block text-[32px] font-black tracking-[0.04em] text-white md:text-[40px]">
        Clouds
      </span>{" "}
      <span className={`mt-1 block text-[9px] font-semibold uppercase tracking-[0.42em] bg-gradient-to-r from-[#8B5CF6] via-[#A855F7] to-[#C084FC] bg-clip-text text-transparent md:text-[11px] ${centered ? "" : "pl-1.5"}`}>
        Community
      </span>
    </span>
  );
}

export function HeaderBrand() {
  return (
    <span className="inline-flex items-center gap-4 border-0" aria-label="Clouds Community">
      <Image
        src="/logo_clouds.png"
        alt="Clouds Community"
        width={64}
        height={64}
        className="object-contain"
        priority
      />
      <BrandWordmark />
    </span>
  );
}


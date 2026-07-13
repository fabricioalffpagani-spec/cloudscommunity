import Image from "next/image";

export function HeaderBrand() {
  return (
    <>
      <Image
        src="/logo_clouds.png"
        alt="Clouds Community"
        width={72}
        height={72}
        className="object-contain"
        priority
      />
      <div className="leading-none">
        <div className="text-[40px] font-black tracking-[-0.06em] text-white md:text-[52px]">
          Clouds
        </div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.72em] bg-gradient-to-r from-[#8B5CF6] via-[#A855F7] to-[#C084FC] bg-clip-text text-transparent md:text-[13px]">
          Community
        </div>
      </div>
    </>
  );
}

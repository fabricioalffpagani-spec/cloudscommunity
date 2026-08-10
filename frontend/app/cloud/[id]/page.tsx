import CloudChat from "./CloudChat";

type CloudPageProps = {
  params?: Promise<{ id?: string }>;
  searchParams?: Promise<{ title?: string; duration?: string; createdAt?: string; participants?: string }>;
};

export default async function CloudPage({ params, searchParams }: CloudPageProps) {
  const resolvedParams = (await params) ?? {};
  const cloudId = resolvedParams.id ?? "unknown";

  const sp = (await searchParams) ?? {};
  const title = sp.title ? decodeURIComponent(sp.title) : undefined;
  const duration = sp.duration ? decodeURIComponent(sp.duration) : undefined;
  const createdAt = sp.createdAt ? decodeURIComponent(sp.createdAt) : undefined;
  const participants = sp.participants ? Number(sp.participants) : undefined;

  return (
    <div className="fixed inset-0 flex flex-col text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(60,15,160,0.70) 0%, rgba(18,6,55,0.98) 45%, #060410 100%)" }}>
      <CloudChat
        cloudId={cloudId}
        title={title}
        duration={duration}
        createdAt={createdAt}
        participants={participants}
      />
    </div>
  );
}

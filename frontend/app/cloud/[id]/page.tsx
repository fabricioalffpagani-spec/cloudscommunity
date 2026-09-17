import CloudChat from "./CloudChat";

type CloudPageProps = {
  params?: Promise<{ id?: string }>;
  searchParams?: Promise<{ title?: string; duration?: string; createdAt?: string; visibility?: string; join?: string }>;
};

export default async function CloudPage({ params, searchParams }: CloudPageProps) {
  const resolvedParams = (await params) ?? {};
  const cloudId = resolvedParams.id ?? "unknown";

  const sp = (await searchParams) ?? {};
  const title = sp.title ? decodeURIComponent(sp.title) : undefined;
  const duration = sp.duration ? decodeURIComponent(sp.duration) : undefined;
  const createdAt = sp.createdAt ? decodeURIComponent(sp.createdAt) : undefined;
  const visibility = sp.visibility ? decodeURIComponent(sp.visibility) : undefined;

  return (
    <div className="fixed inset-0 flex flex-col text-white bg-[#030208]">
      <CloudChat
        cloudId={cloudId}
        title={title}
        duration={duration}
        createdAt={createdAt}
        visibility={visibility}
        joinOnEntry={sp.join === '1'}
      />
    </div>
  );
}

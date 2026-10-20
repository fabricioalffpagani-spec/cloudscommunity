export function ConversationListPreview({ isTyping, lastMessage }: { isTyping: boolean; lastMessage: string }) {
  return (
    <span className={`truncate text-[13px] ${isTyping ? "text-[#C084FC]" : "text-white/50"}`}>
      {isTyping ? "Digitando..." : lastMessage || "No messages yet"}
    </span>
  );
}

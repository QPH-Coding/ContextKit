interface AgentIconProps {
  agentId: string;
  size?: number;
  assigned?: boolean;
}

const agentIconMap: Record<string, string> = {
  claude_code: "/claude.svg",
  claude_desktop: "/claude.svg",
  codex: "/codex.svg",
  kimi: "/kimi.svg",
  cursor: "/cursor.svg",
  codebuddy: "/codebuddy.svg",
  cline: "/cline.svg",
  copilot: "/copilot.svg",
  gemini: "/gemini.svg",
};

const agentMeta: Record<string, { label: string; bg: string }> = {
  claude_code: { label: "Cc", bg: "#CC785C" },
  claude_desktop: { label: "Cd", bg: "#CC785C" },
  cursor: { label: "Cu", bg: "#1A1A1A" },
  codex: { label: "Cx", bg: "#10A37F" },
  kimi: { label: "Ki", bg: "#000000" },
  codebuddy: { label: "CB", bg: "#6366F1" },
};

export default function AgentIcon({ agentId, size = 20, assigned }: AgentIconProps) {
  const iconPath = agentIconMap[agentId];

  if (iconPath) {
    return (
      <img
        src={iconPath}
        alt={agentId}
        className="shrink-0 object-contain"
        style={{
          width: size,
          height: size,
          opacity: assigned ? 1 : 0.5,
          borderRadius: size * 0.2,
        }}
        title={agentId}
      />
    );
  }

  const meta = agentMeta[agentId] || { label: agentId.slice(0, 2).toUpperCase(), bg: "#9CA3AF" };
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold shrink-0 select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: meta.bg,
        color: "#fff",
        fontSize: size * 0.5,
        opacity: assigned ? 1 : 0.5,
      }}
      title={agentId}
    >
      {meta.label}
    </span>
  );
}

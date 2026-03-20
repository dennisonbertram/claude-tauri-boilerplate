import { Sparkle, SquaresFour, Plugs, MagicWand } from '@phosphor-icons/react';
import type { AgentProfile } from '@claude-tauri/shared';

const TEMPLATES = [
  { title: 'Generate a dashboard layout', subtitle: 'With sidebar navigation and data grid', Icon: SquaresFour },
  { title: 'Scaffold an API integration', subtitle: 'Connect to Stripe, Supabase or any REST API', Icon: Plugs },
  { title: 'Review and optimize code', subtitle: 'Analyze performance and suggest improvements', Icon: MagicWand },
];

interface WelcomeScreenProps {
  onNewChat: () => void;
  agentProfiles?: AgentProfile[];
  selectedProfileId?: string | null;
  onSelectProfile?: (id: string | null) => void;
}

export function WelcomeScreen({
  onNewChat,
  agentProfiles,
  selectedProfileId,
  onSelectProfile,
}: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto relative bg-background">
      {/* Subtle grid bg */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none z-0 opacity-60" />

      {/* Content — centered */}
      <div className="flex-1 flex flex-col items-center pt-32 pb-24 px-6 relative z-10">

        {/* Hero section */}
        <div className="w-full max-w-3xl flex flex-col items-center text-center mb-10">
          {/* AI Logo */}
          <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 mb-6 shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.02)]">
            <Sparkle size={24} weight="fill" />
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-foreground mb-3">
            What would you like to build?
          </h1>
          <p className="text-muted-foreground text-base">
            Claude Code is your AI pair programmer.{' '}
            <a
              href="#"
              className="text-foreground underline underline-offset-4 decoration-border hover:decoration-muted-foreground transition-colors"
            >
              Learn how to use it.
            </a>
          </p>
        </div>

        {/* Agent profile selector */}
        {agentProfiles && agentProfiles.length > 0 && onSelectProfile && (
          <div className="flex items-center gap-2 mb-6 flex-wrap justify-center">
            {agentProfiles.map(profile => (
              <button
                key={profile.id}
                onClick={() => onSelectProfile(profile.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selectedProfileId === profile.id
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-white text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                }`}
              >
                {profile.icon && <span className="mr-1.5">{profile.icon}</span>}
                {profile.name}
              </button>
            ))}
          </div>
        )}

        {/* New Conversation button */}
        <button
          onClick={onNewChat}
          className="px-8 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[var(--app-cta)] transition-colors shadow-sm mb-16"
        >
          New Conversation
        </button>

        {/* Template suggestions */}
        <div className="w-full max-w-3xl">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4 px-2">
            <span>Start with a template</span>
          </div>
          <div className="flex flex-col">
            {TEMPLATES.map((template, i) => (
              <div key={template.title}>
                <button
                  onClick={() => onNewChat()}
                  className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-white border border-transparent hover:border-border hover:shadow-sm transition-all text-left w-full"
                >
                  <div className="w-12 h-12 rounded-xl bg-white border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.02)]">
                    <template.Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-foreground font-medium text-[15px]">{template.title}</h3>
                    <p className="text-muted-foreground text-sm mt-0.5">{template.subtitle}</p>
                  </div>
                </button>
                {i < TEMPLATES.length - 1 && (
                  <div className="h-px w-[calc(100%-4rem)] ml-16 bg-border/60 my-1" />
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

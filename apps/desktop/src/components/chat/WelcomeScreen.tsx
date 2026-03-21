import { useState } from 'react';
import { Sparkle, SquaresFour, Plugs, MagicWand, FolderSimple, CaretDown, Plus, Microphone, ArrowUpRight } from '@phosphor-icons/react';

const TEMPLATES = [
  { title: 'Generate a dashboard layout', subtitle: 'With sidebar navigation and data grid', Icon: SquaresFour },
  { title: 'Scaffold an API integration', subtitle: 'Connect to Stripe, Supabase or any REST API', Icon: Plugs },
  { title: 'Review and optimize code', subtitle: 'Analyze performance and suggest improvements', Icon: MagicWand },
];

interface WelcomeScreenProps {
  onNewChat: () => void;
  agentProfiles?: unknown[];
  selectedProfileId?: string | null;
  onSelectProfile?: (id: string | null) => void;
}

export function WelcomeScreen({
  onNewChat,
}: WelcomeScreenProps) {
  const [inputValue, setInputValue] = useState('');

  return (
    <div className="flex-1 flex flex-col overflow-y-auto relative bg-background">
      {/* Subtle grid bg */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none z-0 opacity-60" />

      {/* Content — centered */}
      <div className="flex-1 flex flex-col items-center pt-32 pb-24 px-6 relative z-10">

        {/* Hero section */}
        <div className="w-full max-w-3xl flex flex-col items-center text-center mb-10">
          {/* AI Logo */}
          <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 mb-6 shadow-[inset_0_2px_6px_0_rgba(0,0,0,0.05)]">
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

        {/* Large card composer */}
        <div className="w-full max-w-3xl bg-white rounded-[28px] shadow-[0_8px_30px_-6px_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.02)] border border-border p-3 flex flex-col mb-16 transition-all duration-300 focus-within:shadow-[0_8px_40px_-6px_rgba(0,0,0,0.08),0_4px_12px_-4px_rgba(0,0,0,0.04)] focus-within:border-border/80">
          <textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onNewChat(); }}}
            placeholder="How can I help you build today?"
            className="px-4 py-3 min-h-[120px] max-h-[300px] text-lg text-foreground bg-transparent border-none resize-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between mt-1 pt-2 border-t border-border/0 px-2">
            {/* Left toolbar */}
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent text-muted-foreground text-sm transition-colors border border-transparent hover:border-border">
                <FolderSimple size={18} />
                <span className="font-medium">Select project</span>
                <CaretDown size={12} className="opacity-50" />
              </button>
              <div className="w-px h-4 bg-border mx-1" />
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <Plus size={18} />
              </button>
            </div>
            {/* Right toolbar */}
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent text-muted-foreground text-sm transition-colors">
                <span className="font-medium">Claude Sonnet</span>
                <CaretDown size={12} className="opacity-50" />
              </button>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <Microphone size={18} />
              </button>
              <button
                onClick={onNewChat}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-foreground text-background hover:bg-[var(--app-cta)] transition-colors ml-1 shadow-sm"
              >
                <ArrowUpRight size={18} />
              </button>
            </div>
          </div>
        </div>

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
                  <div className="w-12 h-12 rounded-xl bg-white border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors shadow-[inset_0_2px_6px_0_rgba(0,0,0,0.05)]">
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

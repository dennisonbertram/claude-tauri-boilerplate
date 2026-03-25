import { useState, useRef, useEffect } from 'react';
import { Sparkle, SquaresFour, Plugs, MagicWand, FolderSimple, CaretDown, Plus, Paperclip, Microphone, ArrowUpRight, Check } from '@phosphor-icons/react';
import { ProfileSelector } from '@/components/agent-builder/shared/ProfileSelector';
import { ConnectorList } from './McpStatusPill';
import { useSessionMcpServers } from '../../hooks/useSessionMcpServers';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@/lib/models';
import type { AgentProfile, Project } from '@claude-tauri/shared';

const TEMPLATES = [
  { title: 'Generate a dashboard layout', subtitle: 'With sidebar navigation and data grid', Icon: SquaresFour },
  { title: 'Scaffold an API integration', subtitle: 'Connect to Stripe, Supabase or any REST API', Icon: Plugs },
  { title: 'Review and optimize code', subtitle: 'Analyze performance and suggest improvements', Icon: MagicWand },
];

interface WelcomeScreenProps {
  onNewChat: (profileId?: string) => void;
  onSubmit?: (message: string) => void;
  agentProfiles?: AgentProfile[];
  selectedProfileId?: string | null;
  onSelectProfile?: (id: string | null) => void;
  modelDisplay?: string;
  projects?: Project[];
  selectedProjectId?: string | null;
  onSelectProject?: (projectId: string | null) => void;
  currentModel?: string;
  onSelectModel?: (modelId: string) => void;
}

export function WelcomeScreen({
  onNewChat,
  onSubmit,
  agentProfiles,
  selectedProfileId,
  onSelectProfile,
  modelDisplay = 'Claude',
  projects,
  selectedProjectId,
  onSelectProject,
  currentModel,
  onSelectModel,
}: WelcomeScreenProps) {
  const [inputValue, setInputValue] = useState('');
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [advancedControlsOpen, setAdvancedControlsOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const { activeCount } = useSessionMcpServers(undefined);

  const hasProfileControls = Boolean(onSelectProfile && agentProfiles && agentProfiles.length > 0);
  const hasProjectControls = Boolean(onSelectProject);
  const hasModelControls = Boolean(onSelectModel);
  const hasAdvancedControls = hasProfileControls || hasProjectControls || hasModelControls;

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!projectDropdownOpen && !modelDropdownOpen) return;
    const handleClick = () => { setProjectDropdownOpen(false); setModelDropdownOpen(false); };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [projectDropdownOpen, modelDropdownOpen]);

  useEffect(() => {
    if (!plusMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [plusMenuOpen]);

  const handleSubmit = () => {
    const text = inputValue.trim();
    if (!text) return;
    if (onSubmit) {
      onSubmit(text);
    } else {
      onNewChat();
    }
  };

  const selectedProject = projects?.find(p => p.id === selectedProjectId);
  const selectedProfile = agentProfiles?.find((profile) => profile.id === selectedProfileId);
  const showModelSummary = currentModel ? currentModel !== DEFAULT_MODEL.id : modelDisplay !== DEFAULT_MODEL.label;
  const collapsedSummaries = [
    selectedProfile ? `Profile: ${selectedProfile.name}` : null,
    selectedProject ? `Project: ${selectedProject.name}` : null,
    showModelSummary ? `Model: ${modelDisplay}` : null,
  ].filter(Boolean) as string[];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachedFiles(prev => [...prev, ...Array.from(files)]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto relative bg-background">
      {/* Subtle grid bg */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none z-0 opacity-60" />

      {/* Content — centered */}
      <div className="flex-1 flex flex-col items-center pt-32 pb-24 px-6 relative z-10">

        {/* Hero section */}
        <div className="w-full max-w-3xl flex flex-col items-center text-center mb-10">
          {/* AI Logo */}
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 mb-6 shadow-[inset_0_2px_6px_0_rgba(0,0,0,0.05)]">
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
          <p className="text-sm text-muted-foreground/90 mt-3 max-w-xl">
            Start typing now, or expand the optional setup controls first if you want this chat to start with a specific profile, project, or model.
          </p>
        </div>

        {/* Large card composer */}
        <div className="w-full max-w-3xl bg-card rounded-[28px] shadow-[0_8px_30px_-6px_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.02)] border border-border p-3 flex flex-col mb-16 transition-all duration-300 focus-within:shadow-[0_8px_40px_-6px_rgba(0,0,0,0.08),0_4px_12px_-4px_rgba(0,0,0,0.04)] focus-within:border-border/80">
          <textarea
            aria-label="Start your first message"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }}}
            placeholder="How can I help you build today?"
            className="px-4 py-3 min-h-[120px] max-h-[300px] text-lg text-foreground bg-transparent border-none resize-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
          />

          {/* Attached files preview */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 py-2">
              {attachedFiles.map((file, i) => (
                <span key={`${file.name}-${i}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent text-xs text-foreground border border-border">
                  {file.name}
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground ml-0.5">&times;</button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-1 pt-2 border-t border-border/0 px-2">
            {/* Left toolbar */}
            <div className="flex items-center gap-2">
              <div ref={plusMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setPlusMenuOpen((prev) => !prev)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors relative"
                  title="Attach, commands, connectors"
                >
                  <Plus size={18} />
                  {activeCount > 0 && (
                    <span
                      className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500"
                      aria-hidden="true"
                    />
                  )}
                </button>

                {plusMenuOpen && (
                  <div className="absolute bottom-full left-0 z-20 mb-1.5 min-w-[240px] rounded-lg border border-border bg-popover py-1 shadow-lg">
                    {/* File picker item */}
                    <button
                      type="button"
                      onClick={() => setPlusMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                    >
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span>Add files or photos</span>
                    </button>

                    {/* Slash commands item */}
                    <button
                      type="button"
                      onClick={() => setPlusMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                    >
                      <span className="flex h-4 w-4 items-center justify-center font-mono text-xs text-muted-foreground">/</span>
                      <span>Slash commands</span>
                    </button>

                    {/* Connectors section (global defaults, no session) */}
                    <ConnectorList sessionId={undefined} />
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            {/* Right toolbar */}
            <div className="flex items-center gap-2">
              {/* Microphone — disabled (no speech API integration yet) */}
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/40 cursor-not-allowed transition-colors"
                title="Voice input coming soon"
                disabled
              >
                <Microphone size={18} />
              </button>

              <button
                onClick={handleSubmit}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-foreground text-background hover:bg-[var(--app-cta)] transition-colors ml-1 shadow-sm"
              >
                <ArrowUpRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {hasAdvancedControls && (
          <div className="w-full max-w-3xl mb-10">
            <button
              type="button"
              onClick={() => setAdvancedControlsOpen((prev) => !prev)}
              aria-expanded={advancedControlsOpen}
              aria-controls="welcome-screen-optional-controls"
              className="group flex w-full items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-accent/50"
            >
              <span>Optional setup controls</span>
              <CaretDown
                size={16}
                className={`transition-transform duration-200 ${advancedControlsOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            <p className="text-xs text-muted-foreground/80 mt-2 px-1">
              Expand when you want to set profile, project, or model preferences before sending the first message.
            </p>
            {!advancedControlsOpen && collapsedSummaries.length > 0 && (
              <p className="text-xs text-muted-foreground/85 mt-2 px-1">
                Active for the next chat: {collapsedSummaries.join(' · ')}
              </p>
            )}

            {advancedControlsOpen && (
              <div
                id="welcome-screen-optional-controls"
                className="mt-3 rounded-2xl border border-border/60 bg-card/75 p-4 text-sm"
              >
                {hasProfileControls && (
                  <div className="mb-5">
                    <div className="text-xs text-muted-foreground px-1 mb-1.5">Start as (optional)</div>
                    <p className="text-[11px] text-muted-foreground/85 px-1 mb-2">
                      Profile selection is optional. Choose one to apply its behavior to this chat, or skip it to start without a profile override.
                    </p>
                    <ProfileSelector
                      profiles={agentProfiles}
                      selectedProfileId={selectedProfileId ?? null}
                      onSelectProfile={onSelectProfile}
                    />
                  </div>
                )}

                {hasProjectControls && (
                  <div className="relative">
                    <div className="text-[11px] text-muted-foreground mb-1.5">Project (optional)</div>
                    <p className="text-[11px] text-muted-foreground/80 mb-1.5 max-w-[16rem]">
                      Optional workspace context only. You can start a message without choosing a project.
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setProjectDropdownOpen(p => !p); setModelDropdownOpen(false); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent/70 text-muted-foreground text-sm transition-colors border border-border/80 hover:border-border"
                    >
                      <FolderSimple size={18} />
                      <span className="font-medium">{selectedProject?.name ?? 'Select project'}</span>
                      <CaretDown size={12} className="opacity-60" />
                    </button>
                    {projectDropdownOpen && onSelectProject && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-popover border border-border rounded-xl shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
                        <button
                          onClick={() => { onSelectProject(null); setProjectDropdownOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <FolderSimple size={16} />
                          <span>No project (general chat)</span>
                          {!selectedProjectId && <Check size={14} className="ml-auto text-primary" />}
                        </button>
                        {projects && projects.map(project => (
                          <button
                            key={project.id}
                            onClick={() => { onSelectProject(project.id); setProjectDropdownOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                          >
                            <FolderSimple size={16} className="text-muted-foreground shrink-0" />
                            <span className="truncate">{project.name}</span>
                            {selectedProjectId === project.id && <Check size={14} className="ml-auto text-primary shrink-0" />}
                          </button>
                        ))}
                        {(!projects || projects.length === 0) && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No projects added yet</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {hasModelControls && (
                  <div className={`relative ${hasProjectControls ? 'mt-5 pt-5 border-t border-border/50' : ''}`}>
                    <div className="text-[11px] text-muted-foreground mb-1.5">Model (optional)</div>
                    <p className="text-[11px] text-muted-foreground/80 mb-1.5">
                      Model choice updates the default for new chats. A selected profile can still override it for this run.
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setModelDropdownOpen(p => !p); setProjectDropdownOpen(false); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent/70 text-muted-foreground text-sm transition-colors border border-border/80 hover:border-border"
                    >
                      <span className="font-medium">{modelDisplay}</span>
                      <CaretDown size={12} className="opacity-60" />
                    </button>
                    {modelDropdownOpen && onSelectModel && (
                      <div className="absolute top-full right-0 mt-1 w-48 bg-popover border border-border rounded-xl shadow-lg z-50 py-1">
                        {AVAILABLE_MODELS.map(model => (
                          <button
                            key={model.id}
                            onClick={() => { onSelectModel(model.id); setModelDropdownOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                          >
                            <span>{model.label}</span>
                            {currentModel === model.id && <Check size={14} className="ml-auto text-primary" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Template suggestions */}
        <div className="w-full max-w-3xl">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4 px-2">
            <span>Start with a template</span>
          </div>
          <div className="flex flex-col">
            {TEMPLATES.map((template, i) => (
              <div key={template.title}>
                <button
                  onClick={() => {
                    if (onSubmit) {
                      onSubmit(template.title);
                    } else {
                      onNewChat();
                    }
                  }}
                  className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-card border border-transparent hover:border-border hover:shadow-sm transition-all text-left w-full"
                >
                  <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors shadow-[inset_0_2px_6px_0_rgba(0,0,0,0.05)]">
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

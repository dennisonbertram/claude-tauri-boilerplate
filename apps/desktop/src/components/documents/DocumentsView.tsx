import { useState } from 'react';
import {
  MagnifyingGlass,
  CaretDown,
  FolderOpen,
  FileTs,
  Clock,
  FileCode,
  FileCss,
  FileHtml,
  FileJs,
  File,
} from '@phosphor-icons/react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FileResult {
  id: string;
  name: string;
  path: string;
  modifiedLabel: string;
  lines: { lineNumber: number; text: string; highlighted?: boolean; highlightedSegment?: string }[];
}

interface ProjectGroup {
  projectName: string;
  projectPath: string;
  files: FileResult[];
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const MOCK_RESULTS: ProjectGroup[] = [
  {
    projectName: 'Claude App',
    projectPath: 'src/lib/auth',
    files: [
      {
        id: '1',
        name: 'middleware.ts',
        path: 'src/lib/auth/middleware.ts',
        modifiedLabel: 'Modified 2 days ago',
        lines: [
          { lineNumber: 12, text: 'export async function authMiddleware(req: NextRequest) {' },
          { lineNumber: 13, text: '  const session = await supabase.auth.getSession()', highlighted: true, highlightedSegment: 'supabase.auth' },
          { lineNumber: 14, text: '  if (!session && isProtectedRoute(req.nextUrl.pathname)) {' },
        ],
      },
      {
        id: '2',
        name: 'session-provider.tsx',
        path: 'src/lib/auth/session-provider.tsx',
        modifiedLabel: 'Modified 5 days ago',
        lines: [
          { lineNumber: 45, text: '  useEffect(() => {' },
          { lineNumber: 46, text: '    const { data: { subscription } } = supabase.auth.onAuthStateChange...', highlighted: true, highlightedSegment: 'supabase.auth' },
        ],
      },
    ],
  },
  {
    projectName: 'Marketing Site',
    projectPath: 'packages/ui-kit',
    files: [
      {
        id: '3',
        name: 'AuthCard.tsx',
        path: 'packages/ui-kit/AuthCard.tsx',
        modifiedLabel: 'Modified Oct 12',
        lines: [
          { lineNumber: 8, text: 'export const AuthCard = ({ title, children }: AuthCardProps) => (' },
        ],
      },
    ],
  },
];

const RECENT_SEARCHES = [
  'supabase webhooks',
  'tailwind config extend',
  'postgres optimization',
  'navbar component',
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getFileIcon(name: string) {
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return <FileTs size={18} className="text-blue-500" />;
  if (name.endsWith('.js') || name.endsWith('.jsx')) return <FileJs size={18} className="text-yellow-500" />;
  if (name.endsWith('.css')) return <FileCss size={18} className="text-purple-500" />;
  if (name.endsWith('.html')) return <FileHtml size={18} className="text-orange-500" />;
  if (name.endsWith('.py') || name.endsWith('.rs') || name.endsWith('.go')) return <FileCode size={18} className="text-emerald-500" />;
  return <File size={18} className="text-muted-foreground" />;
}

function renderLine(line: FileResult['lines'][number]) {
  if (!line.highlighted || !line.highlightedSegment) {
    return <span>{line.text}</span>;
  }
  const idx = line.text.indexOf(line.highlightedSegment);
  if (idx === -1) return <span>{line.text}</span>;
  return (
    <span>
      {line.text.slice(0, idx)}
      <span className="bg-orange-200/50 dark:bg-orange-500/20 px-0.5 rounded">{line.highlightedSegment}</span>
      {line.text.slice(idx + line.highlightedSegment.length)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DocumentsView() {
  const [searchQuery, setSearchQuery] = useState('auth middleware');
  const results = MOCK_RESULTS;
  const totalResults = results.reduce((sum, g) => sum + g.files.length, 0);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 flex items-start pt-12 pb-24 px-6 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto">
          {/* Search input */}
          <div className="bg-card rounded-2xl shadow-soft border border-border p-2 mb-8 focus-within:ring-2 focus-within:ring-ring/20">
            <div className="flex items-center gap-3 px-4 py-2">
              <MagnifyingGlass size={24} className="text-muted-foreground/60 shrink-0" />
              <input
                type="text"
                className="flex-1 bg-transparent border-none outline-none text-xl text-foreground placeholder:text-muted-foreground/60"
                placeholder="Search code, projects, and discussions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="flex items-center gap-1 shrink-0">
                <span className="px-1.5 py-0.5 bg-sidebar border border-border rounded text-[10px] text-muted-foreground font-mono">ESC</span>
                <span className="text-xs text-muted-foreground/60 mx-1">to close</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-8 px-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground/60 uppercase">Filter by:</span>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground hover:bg-sidebar-accent/50 transition-colors shadow-sm">
                All Projects <CaretDown size={10} />
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground hover:bg-sidebar-accent/50 transition-colors shadow-sm">
                File type: .ts, .tsx <CaretDown size={10} />
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground hover:bg-sidebar-accent/50 transition-colors shadow-sm">
                Last 30 days <CaretDown size={10} />
              </button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground/60">{totalResults} results found</span>
            </div>
          </div>

          {/* Results grouped by project */}
          <div className="grid grid-cols-1 gap-12">
            {results.map((group) => (
              <section key={group.projectName}>
                <div className="flex items-center gap-2 mb-4 px-2">
                  <FolderOpen size={18} className="text-muted-foreground" />
                  <h2 className="text-[15px] font-semibold text-foreground">{group.projectName}</h2>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span className="text-xs text-muted-foreground/60">{group.projectPath}</span>
                </div>
                <div className="space-y-4">
                  {group.files.map((file) => (
                    <div
                      key={file.id}
                      className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:border-muted-foreground/30 transition-colors cursor-pointer group"
                    >
                      {/* File header */}
                      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getFileIcon(file.name)}
                          <span className="font-medium text-foreground">{file.name}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground/60">{file.modifiedLabel}</span>
                      </div>
                      {/* Code preview */}
                      <div className="p-4 bg-[var(--app-code-bg)] font-mono text-[13px] leading-relaxed text-muted-foreground">
                        {file.lines.map((line) => (
                          <div
                            key={line.lineNumber}
                            className={`flex ${line.highlighted ? 'bg-orange-50/50 dark:bg-orange-500/5' : ''}`}
                          >
                            <span className={`w-8 shrink-0 select-none ${line.highlighted ? 'text-orange-400' : 'text-muted-foreground/30'}`}>
                              {line.lineNumber}
                            </span>
                            {renderLine(line)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Recent searches sidebar — visible on xl screens */}
        <div className="w-64 shrink-0 hidden xl:block sticky top-0 ml-8">
          <div className="px-4 py-2 border-l border-border">
            <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest mb-4">Recent Searches</h3>
            <div className="flex flex-col gap-1">
              {RECENT_SEARCHES.map((term) => (
                <button
                  key={term}
                  onClick={() => setSearchQuery(term)}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-sidebar-accent/50 text-muted-foreground text-sm transition-colors text-left"
                >
                  <Clock size={16} className="opacity-60 shrink-0" />
                  <span className="truncate">{term}</span>
                </button>
              ))}
            </div>
            <button className="mt-6 text-xs text-muted-foreground/60 hover:text-foreground px-2 transition-colors">
              Clear history
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

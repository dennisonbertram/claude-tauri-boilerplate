interface TrackerFiltersProps {
  filters: {
    search: string;
    category: string;
    priority: string;
    assignee: string;
  };
  onFiltersChange: (filters: TrackerFiltersProps['filters']) => void;
}

export function TrackerFilters({ filters, onFiltersChange }: TrackerFiltersProps) {
  const update = (key: keyof typeof filters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const inputClass =
    'bg-muted/50 rounded-md px-2 py-1 text-xs text-foreground border border-border/50 outline-none focus:border-foreground/20 transition-colors';

  return (
    <div data-testid="tracker-filters" className="flex items-center gap-2 px-4 py-2 border-b border-border/50 shrink-0">
      {/* Search */}
      <input
        data-testid="tracker-filter-search"
        type="text"
        value={filters.search}
        onChange={(e) => update('search', e.target.value)}
        placeholder="Search issues..."
        className={`${inputClass} w-48`}
      />

      {/* Status category */}
      <select
        data-testid="tracker-filter-category"
        value={filters.category}
        onChange={(e) => update('category', e.target.value)}
        className={inputClass}
      >
        <option value="">All statuses</option>
        <option value="backlog">Backlog</option>
        <option value="todo">Todo</option>
        <option value="in_progress">In Progress</option>
        <option value="done">Done</option>
        <option value="cancelled">Cancelled</option>
      </select>

      {/* Priority */}
      <select
        data-testid="tracker-filter-priority"
        value={filters.priority}
        onChange={(e) => update('priority', e.target.value)}
        className={inputClass}
      >
        <option value="">All priorities</option>
        <option value="1">Urgent</option>
        <option value="2">High</option>
        <option value="3">Normal</option>
        <option value="4">Low</option>
      </select>

      {/* Assignee */}
      <input
        data-testid="tracker-filter-assignee"
        type="text"
        value={filters.assignee}
        onChange={(e) => update('assignee', e.target.value)}
        placeholder="Assignee..."
        className={`${inputClass} w-32`}
      />

      {/* Clear filters */}
      {(filters.search || filters.category || filters.priority || filters.assignee) && (
        <button
          data-testid="tracker-filter-clear"
          onClick={() => onFiltersChange({ search: '', category: '', priority: '', assignee: '' })}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}

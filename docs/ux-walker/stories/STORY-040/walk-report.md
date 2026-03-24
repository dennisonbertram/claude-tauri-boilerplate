# STORY-040: Filter and Search Workspaces in Sidebar

## Goal
Search and filter workspaces in the sidebar/project view.

## Steps Taken
1. Navigated to Projects view via sidebar "Projects" button.
2. Found search bar: "Search projects..." textbox at top of projects grid.
3. Typed "ai-domain" -- project card remained visible (matching query).
4. Typed "nonexistent" -- project card was hidden, only "New Project" placeholder remained.
5. Found filter buttons: "Status" and "Tech Stack" pill buttons next to search.
6. Clicked "Status" -- appeared to toggle a filter (project card disappeared, no dropdown appeared).
7. Found "Sort by: Last edited" dropdown and grid/list view toggle icons.
8. Sidebar PROJECTS section shows workspace tree (project > workspace) but does not filter with search.

## Result: PARTIAL PASS

Project search works. Filter behavior needs improvement.

## Findings
- **PASS**: Search textbox filters projects in the grid by name.
- **LOW**: "1 total" counter does not update when search filters results.
- **MEDIUM**: Status and Tech Stack filter buttons do not show dropdown/popover options -- they appear to be toggle-style filters without clear feedback about what's being filtered.
- **LOW**: Sidebar workspace list does not filter along with the main grid search.
- **PASS**: Grid/list view toggle icons are present.
- **PASS**: Sort by dropdown is present ("Last edited" default).

## Screenshots
- `screenshots/01-projects-grid.png` -- projects grid with search bar, filters, sort
- `screenshots/02-search-results.png` -- search with "ai-domain" showing matching project
- `screenshots/03-no-results.png` -- search with "nonexistent" showing only New Project card
- `screenshots/04-status-filter.png` -- after clicking Status filter

import type { Project } from '@claude-tauri/shared';

/**
 * Regex that matches slug-like names containing a random short-ID suffix.
 * Examples: "reconcile-ws-fG6AeG", "my-project-aB3xZq", "workspace-Xy9mPL"
 *
 * Pattern: word-chars/hyphens followed by a hyphen and 5-8 random base62 chars at the end.
 * We require the last segment to be exactly 5-8 mixed-case alphanumeric chars (no all-lower,
 * no all-digits) to avoid false-positives like "my-app" or "react-v18".
 */
const SLUG_SUFFIX_RE = /^.+-([A-Za-z0-9]{5,8})$(?!.*[a-z]{9,})/;

/**
 * Returns true if the project name looks like a machine-generated slug
 * (i.e. ends with a short random alphanumeric suffix that mixes upper and lower case
 * or digits with letters, which humans never type by hand).
 *
 * Examples that match (should be replaced):
 *   "reconcile-ws-fG6AeG"   suffix "fG6AeG" — mixed case + digit
 *   "my-project-aB3xZq"     suffix "aB3xZq" — mixed case + digit
 *
 * Examples that do NOT match (kept as-is):
 *   "my-app"                 suffix "app" — too short, all lower
 *   "react-v18"              suffix "v18" — too short
 *   "claude-tauri"           no suffix at all
 *   "my-repo-name"           suffix "name" — all lower, looks like a real word
 */
export function looksLikeSlug(name: string): boolean {
  const match = SLUG_SUFFIX_RE.exec(name);
  if (!match) return false;
  const suffix = match[1];
  // Must have at least one upper-case letter OR at least one digit mixed with letters
  const hasUpper = /[A-Z]/.test(suffix);
  const hasMixedCase = hasUpper && /[a-z]/.test(suffix);
  const hasDigitAndLetter = /[0-9]/.test(suffix) && /[a-zA-Z]/.test(suffix);
  return hasMixedCase || hasDigitAndLetter;
}

/**
 * Given a POSIX or Windows path, return the last non-empty path segment.
 * Works purely on strings — no filesystem access.
 *
 * "/Users/foo/projects/my-repo"  → "my-repo"
 * "C:\\Users\\foo\\my-project"   → "my-project"
 * "/some/path/"                  → "path"
 */
export function basenameFromPath(filePath: string): string {
  // Normalise backslashes
  const normalised = filePath.replace(/\\/g, '/');
  // Strip trailing slashes
  const trimmed = normalised.replace(/\/+$/, '');
  const lastSlash = trimmed.lastIndexOf('/');
  return lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
}

/**
 * Returns the best human-readable display name for a project.
 *
 * Priority:
 *   1. project.name — if it is present and does NOT look like a machine-generated slug
 *   2. basename(project.repoPathCanonical) — derived from the canonical path
 *   3. basename(project.repoPath)          — fallback if canonical is empty
 *   4. project.name as-is                 — last resort
 */
export function getProjectDisplayName(project: Pick<Project, 'name' | 'repoPath' | 'repoPathCanonical'>): string {
  // If the stored name is clean and human-readable, just use it.
  if (project.name && !looksLikeSlug(project.name)) {
    return project.name;
  }

  // Derive a friendly name from the repo path.
  const fromCanonical = project.repoPathCanonical ? basenameFromPath(project.repoPathCanonical) : '';
  if (fromCanonical) return fromCanonical;

  const fromPath = project.repoPath ? basenameFromPath(project.repoPath) : '';
  if (fromPath) return fromPath;

  // Absolute last resort: return whatever is in the name field.
  return project.name;
}

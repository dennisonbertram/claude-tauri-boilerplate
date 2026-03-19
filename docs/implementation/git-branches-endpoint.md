# Implementation: GET /api/git/branches

## Summary

Added a `GET /api/git/branches?path=<absolutePath>` endpoint to the existing git router.

## File Modified

**`/Users/dennisonbertram/Develop/claude-tauri-boilerplate/apps/server/src/routes/git.ts`**

The new route was appended to the existing `createGitRouter()` function, which is already mounted at `/api/git` in `app.ts` (line 53).

## Implementation Details

### Route

```
GET /api/git/branches?path=<URL-encoded absolute path>
```

### Logic

1. Reads `path` from query params.
2. Returns 400 if `path` is missing or does not start with `/` (not absolute).
3. Runs `git rev-parse --git-dir` in the given directory to verify it is a valid git repository; returns 400 if it fails.
4. Runs `git branch -a --format=%(refname:short)` to list all local and remote branches using the short ref name format (avoids `refs/heads/` and `refs/remotes/` prefixes).
5. Filters out empty lines and `origin/HEAD -> origin/main`-style entries (detected by the presence of ` -> `).
6. Returns a JSON array of `{ name: string }` objects.

### Success Response

```json
[
  { "name": "main" },
  { "name": "feature/auth" },
  { "name": "origin/main" },
  { "name": "origin/feature/auth" }
]
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | `path` query parameter missing |
| 400 | `path` does not start with `/` (not absolute) |
| 400 | Directory is not a git repository or does not exist |
| 400 | `git branch` command failed for another reason |

## Why git.ts (not a new file)

`app.ts` already registers `createGitRouter()` at `/api/git`. The `runGit` helper is defined in that file and handles Bun process spawning and exit-code checking. Adding the branches endpoint there avoids code duplication and keeps all standalone git utilities in one place.

## No app.ts Changes Required

The route is served automatically at `GET /api/git/branches` because `createGitRouter()` is already mounted at `/api/git` — no changes to `app.ts` were needed.

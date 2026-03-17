export interface CommandSearchable {
  name: string;
  description: string;
}

const EXACT_START_BONUS = 1_600;
const EXACT_SUBSTRING_BONUS = 1_200;
const DESCRIPTION_BOOST = 300;
const SUBSEQUENCE_BASE = 300;

function findSubsequence(text: string, query: string): number | null {
  let pos = 0;
  let lastMatch = -1;
  let score = 0;

  for (const char of query) {
    const idx = text.indexOf(char, pos);
    if (idx === -1) {
      return null;
    }

    // Favor adjacency and early matches.
    const adjacency = lastMatch === -1 ? 0 : idx - lastMatch;
    score += 40;
    if (adjacency === 1) {
      score += 30;
    }
    score += Math.max(0, 25 - idx);

    lastMatch = idx;
    pos = idx + 1;
  }

  return score;
}

function scoreMatch(value: string, query: string): number | null {
  if (!query) {
    return null;
  }

  if (value.startsWith(query)) {
    return EXACT_START_BONUS - value.length;
  }

  const exactIndex = value.indexOf(query);
  if (exactIndex !== -1) {
    return EXACT_SUBSTRING_BONUS - exactIndex;
  }

  return findSubsequence(value, query);
}

export function rankCommandsByRelevance<T extends CommandSearchable>(
  commands: T[],
  query: string
): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...commands];
  }

  const ranked = commands
    .map((command) => {
      const name = command.name.toLowerCase();
      const description = command.description.toLowerCase();

      const nameExact = scoreMatch(name, normalized);
      const descriptionExact = scoreMatch(description, normalized);

      if (nameExact === null && descriptionExact === null) {
        return null;
      }

      const score =
        nameExact !== null
          ? nameExact + SUBSEQUENCE_BASE
          : (descriptionExact ?? Number.NEGATIVE_INFINITY) - DESCRIPTION_BOOST;

      // Prefer name matches; only use description scoring as a fallback.
      return {
        command,
        score,
      };
    })
    .filter((entry): entry is { command: T; score: number } =>
      entry !== null && Number.isFinite(entry.score)
    )
    .sort((a, b) => {
      if (a.score === b.score) {
        return a.command.name.localeCompare(b.command.name);
      }
      return b.score - a.score;
    });

  return ranked.map((entry) => entry.command);
}

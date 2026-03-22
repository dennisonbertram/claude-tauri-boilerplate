export function parseKeyValuePairs(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pairs = input.split(',');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      const key = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      if (key) result[key] = value;
    }
  }
  return result;
}

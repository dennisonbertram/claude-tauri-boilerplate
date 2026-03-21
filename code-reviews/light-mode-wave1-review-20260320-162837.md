Review Report: Light-Mode Design System Migration

Based on the merged code (index.html, src/index.css), here is the requested review:

---

### CRITICAL

- **None found.**

---

### HIGH

- **None found.**

---

### MEDIUM

- **OKLCH variable values - accessibility/contrast**:  
  The new warm parchment palette uses very light backgrounds (`--background: oklch(0.991 0.003 80)`) and muted foregrounds. There is a risk that contrast ratios may be suboptimal for accessibility, especially for users with low vision or in certain lighting conditions. Please validate all key background/foreground pairs against WCAG AA contrast requirements.

---

### LOW

- **Font fallback order for Newsreader**:  
  The serif font fallback includes only `'Newsreader', Georgia, serif;` in `--font-serif`. While adequate for most, consider checking if `"Times New Roman", Times, serif` might be necessary in edge cases where Georgia is not available.

- **Unused .scrollbar-hide, .scrollbar-none utilities**:  
  Both `scrollbar-hide` and `scrollbar-none` utilities are present and do the same thing; one could be removed if unused. However, if used for clarity in different frameworks, this is acceptable.

- **Theme variables for code background**:  
  The variable `--app-code-bg` is set to a dark color (`#1e1e1e`) in light mode. Since this is for code blocks, it's normal, but be sure the rest of your code styling (text color in code blocks) ensures good readability.

---

### Change Specification Compliance

- **Dark mode activation removed from HTML:**  
  Confirmed. No `class="dark"` in index.html.
- **:root CSS variables warm parchment palette:**  
  Confirmed, using `oklch()` in new palette.
- **Semantic status variables added:**  
  Confirmed: `--app-success`, `--app-error`, etc.
- **Shadow and grid pattern, custom scrollbar:**  
  Confirmed all present and correct.
- **Fonts:**  
  Geist fully removed, variables refactored for Inter, Newsreader, JetBrains Mono.
- **.dark block present, unchanged, not activated:**  
  Confirmed.
- **Font @theme inline with correct font vars:**  
  Confirmed.

---

CRITICAL: 0  
HIGH: 0  
APPROVED: YES

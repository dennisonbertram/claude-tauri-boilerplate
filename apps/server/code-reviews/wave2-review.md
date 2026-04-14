Here’s a focused review of the 4 connectors against your checklist.

## Overall
- **`sanitizeError` usage:** generally good across all 4 connectors; handlers consistently sanitize surfaced errors.
- **Annotations (`openWorldHint` / `readOnlyHint`):** values look correct in code for all 4; only **Contacts** has explicit test coverage for them.
- **Main blockers:**
  - **Contacts:** Google OAuth token is accepted as an LLM-facing tool arg.
  - **Google Maps:** broken factory export shape, plus major missing fencing of untrusted output.
- **No CRITICAL issues found** in this subset.

---

# 1) Contacts

### What looks good
- Strong overall use of `sanitizeError`.
- Good use of `fenceUntrustedContent` on most Apple/Google contact fields.
- JXA script interpolation uses `JSON.stringify(...)`, which materially reduces script injection risk.
- Annotation values are correct and well-tested.
- Test coverage is the strongest of the 4 connectors.

### Issues

#### HIGH
1. **OAuth access token is exposed as a tool parameter**
   - **Where:** `src/connectors/contacts/tools.ts` (`googleAccessToken` on `contacts_search`, `contacts_get`, `contacts_list_groups`)
   - **Why it matters:** this makes bearer tokens part of the tool schema/invocation payload, so tokens can end up in model context, logs, traces, and transcripts.
   - **Recommendation:** move Google auth to connector-managed auth (db-backed / auth client), remove `googleAccessToken` from LLM-facing schemas, and gate Google mode via connector auth state.

#### MEDIUM
1. **Raw Google `resourceName` is concatenated into the request path without validation/encoding**
   - **Where:** `getGoogleContact()` in `src/connectors/contacts/tools.ts`
   - **Issue:**  
     ```ts
     `https://people.googleapis.com/v1/${resourceName}?personFields=...`
     ```
     A crafted value can alter path/query semantics.
   - **Recommendation:** validate against an allowlist like `^people\/[^/?#]+$` and/or encode only the ID suffix.

2. **Connector metadata encourages the unsafe auth pattern**
   - **Where:** `src/connectors/contacts/index.ts`
   - **Issue:** `requiresAuth: false`, even though Google-backed use cases require OAuth. That mismatch nudges callers toward pasting tokens into tool args.
   - **Recommendation:** split Apple Contacts vs Google Contacts auth models, or make Google mode use managed auth and set metadata accordingly.

#### LOW
1. **Schemas are a bit loose**
   - `query`, `id`, `name`, `firstName`, `lastName` accept empty strings.
   - `email` / `phone` are plain strings with no validation.
   - Recommend `.trim().min(1)` where appropriate, plus `z.string().email()` for email if desired.

2. **Missing regression tests for the risky parts**
   - No tests for `resourceName` validation/encoding.
   - No tests guarding against secret-in-args design.

---

# 2) Google Maps

### What looks good
- `sanitizeError` is used correctly in handlers.
- `placeId` is encoded in `getPlaceDetails()`.
- Annotation values in code look correct.

### Issues

#### HIGH
1. **`googleMapsConnectorFactory` is not actually a factory**
   - **Where:** `src/connectors/google-maps/index.ts`
   - **Issue:** it exports:
     ```ts
     export { googleMapsConnector as googleMapsConnectorFactory };
     ```
     but `googleMapsConnector` is a `ConnectorDefinition` object, not a `ConnectorFactory`.
   - **Impact:** callers expecting `(db) => ConnectorDefinition` will break.
   - **Recommendation:** export a real factory function, even if `db` is unused.

2. **Major missing fencing of untrusted output**
   - **Where:** `src/connectors/google-maps/tools.ts`
   - **Examples:**
     - `maps_geocode`: raw `args.address`, raw `formattedAddress`, raw `placeId`
     - `maps_directions`: raw `origin`, `destination`, `route.description`, `step.instruction`
     - `maps_search_places`: raw `args.query`
     - `maps_place_details`: raw `review.author`, `weekdayDescriptions`, `website`, `phoneNumber`
   - **Why it matters:** this is prompt-injection surface from user input and external API data.
   - **Recommendation:** fence all user-supplied and externally sourced strings at final tool-output time.

#### MEDIUM
1. **Routes API response parsing is incorrect for `duration`**
   - **Where:** `getDirections()` in `src/connectors/google-maps/tools.ts`
   - **Issue:** code expects:
     ```ts
     duration?: { seconds?: string; text?: string }
     ```
     but Google Routes API returns duration as a string like `"1800s"`.
   - **Impact:** real responses may show `Unknown` duration or parse incorrectly.
   - **Recommendation:** update typings/parsing to match actual API response shape.

#### LOW
1. **Schemas should be tightened**
   - `maps_search_places.maxResults` is not `.int()`.
   - String inputs allow empty/whitespace-only values.
   - Recommend `.trim().min(1)` for strings and `.int()` for count-like fields.

2. **Test coverage misses the real problems**
   - Tests focus on exported helper functions more than SDK tool handlers.
   - No tests for:
     - actual tool output fencing in geocode/directions
     - annotation metadata
     - broken factory export contract
   - Some tests claim fencing but only assert raw text presence, not fence markers.

---

# 3) Google Photos

### What looks good
- Good auth model: token retrieved internally, not exposed as a tool arg.
- Good use of `sanitizeError`.
- Path components (`sessionId`, `mediaItemId`) are encoded.
- Annotation values look correct.
- Test coverage is solid on happy-path/error-path behavior.

### Issues

#### MEDIUM
1. **Incomplete fencing of opaque external values**
   - **Where:** `src/connectors/google-photos/tools.ts`
   - **Raw outputs include:** session IDs, picker URIs, next page tokens, album IDs, product URLs, base URLs.
   - **Why it matters:** these are still externally sourced strings/tokens and should be treated as untrusted at the output boundary.
   - **Recommendation:** fence opaque IDs/tokens/URLs the same way filenames/titles/descriptions are fenced.

#### LOW
1. **Schemas accept empty identifiers**
   - `sessionId`, `mediaItemId`, `pageToken` should likely use `.trim().min(1)`.

2. **Tests don’t cover annotation metadata or the unfenced opaque fields**
   - Good behavior coverage overall, but no regression tests for the missing fencing above.

---

# 4) Strava

### What looks good
- Good use of `sanitizeError`.
- Query construction is safe; no path traversal concerns here.
- Most high-risk free-text fields are fenced.
- Annotation values in code look correct.
- Test coverage is reasonably good.

### Issues

#### MEDIUM
1. **Uses global env token instead of connector-managed per-user auth**
   - **Where:** `src/connectors/strava/tools.ts`
   - **Issue:** `process.env.STRAVA_ACCESS_TOKEN` is used directly and injected `db` is ignored.
   - **Why it matters:** in a multi-user/profile-separated desktop app, this can mix credentials and bypass proper per-user auth isolation.
   - **Recommendation:** move to stored/user-scoped auth retrieval, consistent with other OAuth-backed connectors.

2. **Partial fencing gap in athlete profile output**
   - **Where:** `strava_get_athlete`
   - **Issue:** `username`, `state`, and `country` are emitted raw. These are still external/profile-controlled strings.
   - **Recommendation:** fence them just like `fullName`, `bio`, and `city`.

#### LOW
1. **Tests do not verify annotations or auth model behavior**
   - No regression tests for `readOnlyHint` / `openWorldHint`.
   - No coverage for env-token vs per-user auth design.

---

# Counts / Approval

| Connector | CRITICAL | HIGH | MEDIUM | LOW | APPROVED |
|---|---:|---:|---:|---:|---|
| Contacts | 0 | 1 | 2 | 2 | NO |
| Google Maps | 0 | 2 | 1 | 2 | NO |
| Google Photos | 0 | 0 | 1 | 2 | YES |
| Strava | 0 | 0 | 2 | 1 | YES |

## Total
- **CRITICAL:** 0
- **HIGH:** 3
- **MEDIUM:** 6
- **LOW:** 7

If you want, I can turn this into a PR-style checklist with exact remediation steps per file/function.

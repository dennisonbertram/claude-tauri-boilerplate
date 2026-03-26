# Plaid Sandbox Testing

Manual and browser-assisted testing notes for the Plaid Hosted Link flow in development.

This is the source of truth for Plaid sandbox test credentials, the browser callback flow, and the recommended `agent-browser` workflow.

## Sandbox Test Data

- **Sandbox phone number:** `415-555-0011`
- **Observed sandbox verification code:** `123456`

Use this number when the Plaid sandbox flow asks for a phone during authentication or verification.
In the current remembered-user sandbox flow, entering `123456` on the "Verify your phone number" screen advanced to account selection.

## Recommended `agent-browser` Workflow

For automated testing, keep the Plaid hosted flow inside the same browser session whenever possible.

### Why

In Tauri desktop mode the app uses `shell.open(...)`, which hands the Plaid URL to the system browser. That is fine for real usage, but it is harder to control from `agent-browser`.

For browser-based testing, prefer the dev-mode callback path or open the hosted Plaid URL directly in `agent-browser`.

### Option 1: Trigger from the app in browser dev mode

1. Open the app Finance screen in `agent-browser`
2. Click `Connect Bank Account`
3. If Plaid opens in a new tab, use `agent-browser tab list` and switch to that tab
4. Continue the hosted login flow with snapshots and fills

In the current dev flow, the server appends the Plaid `state` to the browser callback URI so the app can finalize the connection even when Plaid does not include `public_token` in the redirect.

Example:

```bash
agent-browser --session-name plaid-test open http://localhost:1757/#/finance
agent-browser --session-name plaid-test snapshot -i -C
agent-browser --session-name plaid-test click @e27
agent-browser --session-name plaid-test tab list
```

Expected result after account confirmation:

- Plaid redirects back to `#/finance/callback?state=...`
- The desktop app finalizes the session through `/api/plaid/link/finalize`
- The UI navigates back to `/finance`
- Connected institutions appear in the Finance view

### Option 2: Open the hosted Plaid URL directly

This is the most reliable automation path.

1. Create a link session from the local server
2. Copy the returned `hosted_link_url`
3. Open that URL directly with `agent-browser`

Example:

```bash
curl -s -X POST http://localhost:<api-port>/api/plaid/link/start \
  -H 'Content-Type: application/json' \
  -d '{"completion_redirect_uri":"http://localhost:1757/#/finance/callback"}'

agent-browser --session-name plaid-test open '<hosted_link_url>'
agent-browser --session-name plaid-test snapshot -i -C
```

This keeps the entire Plaid flow inside one controllable browser session.

## Automating the Hosted Login

Once the Plaid page is open:

1. Take a snapshot: `agent-browser snapshot -i -C`
2. Fill the visible fields using refs from the snapshot
3. Re-snapshot after every major screen change
4. Use the sandbox phone number `415-555-0011` if Plaid asks for phone verification
5. If the hosted flow shows a code verification screen for the remembered sandbox user, try `123456`
6. Check `agent-browser console` and `agent-browser errors` after each major step

Typical commands:

```bash
agent-browser --session-name plaid-test snapshot -i -C
agent-browser --session-name plaid-test fill @e1 "user_good"
agent-browser --session-name plaid-test fill @e2 "pass_good"
agent-browser --session-name plaid-test click @e3
agent-browser --session-name plaid-test wait 1500
agent-browser --session-name plaid-test snapshot -i -C
```

## Notes

- If popups behave inconsistently in headless mode, rerun in a headed browser session.
- If the app opens a blank popup, verify that the frontend is receiving a real `hostedLinkUrl` and not `undefined`.
- If callback finalization fails in browser mode, verify the hosted redirect URL includes `state` in the callback hash query and that `/api/plaid/link/finalize` accepts a state-only request.
- If callback finalization fails in Tauri deep-link mode, verify the callback includes both `state` and `public_token`.

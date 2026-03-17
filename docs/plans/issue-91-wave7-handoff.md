# Issue #91 wave 7 handoff

## Scope completed
- Added default client slash commands for `/restart` and `/add-dir` while keeping existing aliases intact.
- Frontend now treats unknown slash commands as invalid unless they are advertised by the SDK as plugin-installed slash commands.
- Server no longer rejects non-client slash commands at the API boundary, so plugin commands can pass through correctly.
- Session init events now carry `slashCommands` metadata through the event mapper to the frontend reducer.

## Targeted automated validation

- `cd apps/server && bun test src/routes/chat-commands.test.ts src/services/event-mapper.test.ts`
- `cd apps/desktop && pnpm test -- useCommands ChatPageSlashCommands useStreamEvents`

Result:
- server: `54 pass, 0 fail`
- desktop targeted run: `74 files passed, 994 tests passed`

## Manual browser verification note
1. Start the app (`pnpm dev:all`) and open `http://localhost:1420`.
2. In chat input, type `/` and verify the command autocomplete opens with available slash commands.
3. Type `cmpt` after slash (`/cmpt`) and verify fuzzy matching still surfaces `/compact`.
4. Verify `/restart` and `/add-dir` appear in the autocomplete list.
5. Type an invalid slash command such as `/does-not-exist` and press Enter; verify the UI renders an inline chat error without clearing any current attachments.
6. If the active SDK session advertises plugin slash commands, type one such as `/plugin-cmd` and verify it is submitted instead of being blocked locally.

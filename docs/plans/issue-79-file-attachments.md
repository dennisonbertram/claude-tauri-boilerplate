# Issue #79: File picker, @-mentions, and drag-and-drop file attachments

## Scope

Deliver the first vertical slice for file attachment support in chat input:
- select files via picker
- paste/drop files and folders
- mention files with `@` inline from workspace context
- render file thumbnails and non-image attachments inline before send

## Acceptance Criteria

- [ ] File picker and fuzzy file search
- [ ] Inline @-mentions for files
- [ ] Drag-and-drop for files and folders
- [ ] Inline image rendering and non-image previews

## Wave 1 Checklist

- [x] Add attachment model to `ChatInput` with support for image and non-image file previews.
- [x] Add file picker input and attach button with stable test id.
- [x] Add paste + drop handlers that accept files, including `DataTransfer.items` + `webkitGetAsEntry` recursion for folder drops.
- [x] Add inline `@` mention detection with candidate filtering and keyboard/ click selection.
- [x] Thread file suggestions from `ChatPage` into `ChatInput` using workspace diff state.
- [x] Append attachment references to message payload when sending so backend receives attachment context.
- [ ] Add backend contract/validation for attachment references and server-side file resolution (next wave).
- [ ] Add richer drag/drop/folder tests (folder-specific case with nested files).
- [ ] Add attachment preview rendering and mention-selection UX polish in existing visual styles.

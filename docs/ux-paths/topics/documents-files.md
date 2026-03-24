# Documents & File Management — User Journey Stories

**Topic**: Document upload, storage, preview, tagging, and session linking  
**Generated**: 2026-03-23

---

## Quick Story Reference

| # | Story | Type | Length | Focus |
|---|-------|------|--------|-------|
| 1 | First document upload | Onboarding | **SHORT** | Empty state → successful upload flow |
| 2 | Browse & search documents | Core interaction | **SHORT** | Finding documents by name |
| 3 | Rich document preview | Core interaction | **MEDIUM** | Multiple preview types (text, image, PDF, CSV) |
| 4 | Tag & organize documents | Core interaction | **MEDIUM** | Tagging system + tag-based filtering |
| 5 | Link document to session | Advanced | **MEDIUM** | Document-session association during upload |
| 6 | Batch upload & error handling | Advanced | **MEDIUM** | Multiple files + partial failures |
| 7 | Open document on system | Power user | **MEDIUM** | Launch with native app, file path access |
| 8 | Document context menu mastery | Power user | **LONG** | Copy file path, link, download, delete |
| 9 | Gallery vs table views | Power user | **LONG** | Visual browsing + structured data view |
| 10 | Large file preview & limits | Edge case | **LONG** | Content truncation, file type fallbacks |

---

## Detailed Stories

### 1. First Document Upload (SHORT)
**User**: Solo Developer starting a new project  
**Goal**: Upload a research document to the app

**Context**:
- User is new to the Documents feature
- Sees the Documents page for the first time
- View shows empty state with prompt to upload

**Journey**:
1. User lands on `/documents` route
   - Empty state displays: "No documents yet" + upload icon
   - Two options visible: drag-and-drop zone or "Upload Document" button
2. User clicks the **Upload Document** button
   - File picker opens (accepts all file types)
3. User selects a single `.pdf` file (research paper, ~2MB)
4. File is uploaded via `POST /api/documents/upload`
   - Progress handling: request completes, document record created
   - `status: 'ready'` set immediately (no processing pipeline)
5. Page updates automatically:
   - Document appears at top of list as a card with:
     - PDF icon (red) + thumbnail preview area
     - Filename, size, upload timestamp
     - Hover actions: Download, Delete
6. Search bar is now visible in header
7. Success: User can immediately see their document and interact with it

**Key Interactions**:
- Drag-and-drop UX: Visual feedback with "Drop files to upload" overlay
- File input validation: Any type accepted (filtering happens at API level if needed)
- Optimistic UI update: New doc appears immediately in list

**Error Handling**:
- Upload fails → Error message shown, document doesn't appear
- File too large → Server returns 400 error (if size limit exists)

---

### 2. Browse & Search Documents (SHORT)
**User**: Developer with 15+ documents in library  
**Goal**: Find a specific document by name without scrolling

**Context**:
- Documents view is populated with mixed file types
- Gallery view shows 4-5 columns of cards
- User remembers partial filename

**Journey**:
1. User opens Documents page
   - Sees header with:
     - "Documents" title + count badge (15 total)
     - Search input placeholder: "Search documents..."
     - Gallery/Table view toggle
     - Upload button
2. User clicks search input and types: "report"
   - Query filters documents client-side
   - Results update in real-time (substring match on filename)
   - Only documents with "report" in the filename remain visible
3. User sees 3 matching results:
   - `quarterly_report_2026.pdf`
   - `monthly_report_jan.xlsx`
   - `system_report.txt`
4. User clicks the desired document
   - Preview modal opens (see Story 3)
5. To clear search:
   - User clears the input field → all documents reappear

**Key Interactions**:
- Search is real-time, no debounce delay
- Case-insensitive matching: "REPORT" = "report" = "Report"
- Empty search results state: "No documents match your search"

**Accessibility Notes**:
- Search input has visible focus ring
- Results update with smooth animation (fade in/out)

---

### 3. Rich Document Preview (MEDIUM)
**User**: Developer reviewing document content before use  
**Goal**: Preview different document types (text, image, PDF, CSV, code)

**Context**:
- User has opened a document from gallery or table
- Modal fills entire screen with document content
- Multiple file types in library

**Scenario A: Image Preview**:
1. User clicks an `.png` image document
   - Preview modal opens with image rendered full-size
   - Zoom controls appear top-right:
     - Magnifying glass (–) to zoom out
     - Reset button to 1x scale
     - Magnifying glass (+) to zoom in
   - Zoom range: 0.25x to 5x scale
   - Image scales smoothly on click or button press
   - Scrollable if image exceeds viewport
2. User zooms to 2x, clicks elsewhere
   - Zoom persists while modal open
   - Navigation arrows (left/right) switch to previous/next document
3. User closes modal (Escape key or X button)

**Scenario B: PDF Preview**:
1. User clicks a `.pdf` document
   - Modal opens with embedded PDF viewer (iframe)
   - Full PDF.js functionality or browser native
   - User can scroll, zoom, search within PDF

**Scenario C: Text/Code/Markdown**:
1. User clicks a `.md` (markdown) file
   - Modal detects type: 'markdown'
   - Fetches content via `GET /api/documents/{id}/content`
   - Renders as formatted markdown with:
     - Headings, code blocks, lists, links all styled
     - Tables, images, blockquotes supported
   - Content is scrollable, max 3-column width for readability
2. For code file (`.js`, `.py`, etc.):
   - Type detected as 'code'
   - Content displayed in monospace font with:
     - Line numbers (right-aligned, muted color)
     - Syntax highlighting compatible background
     - Filename shown in header
3. For plain text (`.txt`, `.log`):
   - Type: 'text'
   - Raw content displayed in monospace
   - Filename header bar shows

**Scenario D: CSV/Spreadsheet**:
1. User clicks a `.csv` file
   - Content fetched and parsed client-side
   - Rendered as HTML table with:
     - Header row (bold, muted background)
     - Data rows with alternating row colors
     - Columns sized to content, horizontal scroll if needed
     - Status: "Showing first 500 of 1250 rows" if truncated
   - TSV (tab-separated) auto-detected by `.tsv` extension

**Scenario E: JSON**:
1. User clicks a `.json` file
   - Content fetched, parsed, and pretty-printed (2-space indent)
   - Displayed in monospace with:
     - Scrollable container
     - No syntax highlighting (plain text format)

**Scenario F: Office Documents**:
1. User clicks `.xlsx`, `.docx`, `.key`, `.pages`, etc.
   - Type: 'office'
   - Preview not available (server returns 415)
   - Modal shows card with:
     - File type icon (Word/Excel/Keynote specific)
     - Filename, file type label, size
     - Two buttons:
       - "Open on Computer" → launches native app
       - "Download" → saves file locally
   - User can still navigate to next/prev document

**Scenario G: Unsupported Type**:
1. User clicks an `.exe`, `.zip`, or unknown binary
   - Type: 'unsupported'
   - Modal shows fallback card:
     - Download icon
     - "Preview not available for this file type"
     - MIME type displayed (e.g., `application/octet-stream`)
     - "Open on Computer" and "Download" buttons

**Modal Features (All Types)**:
- **Header bar**:
  - Left: Navigation arrows (disabled if no prev/next)
  - Center: Filename (truncated if long)
  - Right: Download button, Open on Computer button, Close button (X)
  - Keyboard shortcut hints visible on hover
- **Footer bar**:
  - File icon + filename
  - Separator (•)
  - File type badge (color-coded: blue for text, red for PDF, etc.)
  - Separator (•)
  - File size + relative date
- **Keyboard shortcuts**:
  - `Escape` → Close modal
  - `←` (left arrow) → Previous document
  - `→` (right arrow) → Next document
  - `D` → Download (only if not typing in input)
- **Content errors**:
  - If content fetch fails: "Failed to load content" + error message + "Open on Computer" button
  - Graceful fallback to native app

**Edge Cases**:
- File missing on disk → `getDocument()` succeeds but `GET /:id/file` returns 404
- Large file (>500KB) → Content truncated: "... (truncated, file is 2500 KB)"
- Unsupported MIME type for preview → Display fallback UI

---

### 4. Tag & Organize Documents (MEDIUM)
**User**: Developer organizing research materials by topic  
**Goal**: Add tags to documents, filter by tags, remove tags

**Context**:
- User has 8 documents about different projects
- Wants to group by research type: "research", "proposal", "approved"
- Tags stored in SQLite as JSON array per document

**Journey**:
1. User opens Documents page, sees gallery view
2. User right-clicks on a document → context menu appears (see Story 8)
   - Note: Current UI has disabled "Rename" button
   - Tags feature may be accessible via:
     - Modal edit mode (future)
     - Inline tag editor in card
     - Side panel
   - **Assumption**: Tags UI accessible via right-click or modal

3. **Add tags** scenario (implementation TBD):
   - User opens tag editor for document
   - Input field with placeholder: "Add tags (comma-separated)"
   - User types: "research, api-design, Q1"
   - Each tag appears as a pill/badge
   - User hits Enter or clicks Add → saved via `PATCH /api/documents/{id}`
   - Tags persist in DB as: `["research", "api-design", "Q1"]`

4. **View tags on card**:
   - Gallery card shows 1-2 tags as small badges below filename
   - Remaining tags hidden ("+ 1 more" if truncated)
   - Table view shows all tags in a column

5. **Filter by tag** (future feature):
   - Tag badge is clickable
   - Click → filter to only documents with that tag
   - Or: Add "Filter by tags" UI in header

6. **Remove tag**:
   - User clicks X on tag badge
   - Tag removed from array
   - Saved immediately via PATCH

**API Integration**:
- `updateDocumentTags(id, ["tag1", "tag2"])` → `PATCH /api/documents/{id}`
- Server updates `tags` column (JSON stringified)
- Validation: tags are strings, no empty strings
- No duplicate tags (frontend deduplication)

**Error Handling**:
- Tag update fails → Toast error "Failed to update tags"
- User can retry by clicking tag again

---

### 5. Link Document to Session (MEDIUM)
**User**: AI Developer assigning research material to active coding session  
**Goal**: Associate a document with the current chat session for context

**Context**:
- User is in an active chat session (e.g., `/chat` with session ID `sess-abc123`)
- User has a research document that's relevant to the current task
- Document can be linked during upload or after

**Journey A: Link During Upload**:
1. User is in chat session, switches to Documents view
   - Session context available (passed from URL or session state)
2. User uploads a file via "Upload Document" button
   - Upload form (or drag-drop) includes:
     - File picker
     - Optional: Checkbox/toggle "Link to current session"
   - User checks the option
3. `POST /api/documents/upload` called with:
   ```
   {
     file: File,
     sessionId: "sess-abc123"
   }
   ```
4. Document created with `sessionId` set
   - Document stored in DB with session reference
5. User returns to chat
   - Option to view linked documents in sidebar or context panel
   - User can cite document in prompt: "Based on [Document: research.pdf]..."

**Journey B: Link After Upload**:
1. Document already uploaded (sessionId = null)
2. User opens document preview modal
   - Modal includes footer/action bar with "Link to session" button
   - Dropdown/menu to select which session (if multiple active)
3. User clicks "Link to session"
   - `PATCH /api/documents/{id}` called with `sessionId`
4. Document now associated with that session

**Use Cases**:
- Provide AI with research context
- Session-specific document organization
- Export documents with session (future)
- Session replay includes linked documents

**Edge Cases**:
- User uploads document while no session is active
  - sessionId remains null
  - User can link later from document modal
- User links document to multiple sessions?
  - Current schema: one sessionId per document
  - Future: many-to-many junction table

---

### 6. Batch Upload & Error Handling (MEDIUM)
**User**: Developer importing multiple research files at once  
**Goal**: Upload 5-10 documents, handle partial failures gracefully

**Context**:
- User drags 10 files to Documents view
- 3 files fail (invalid type, server error, etc.)
- User sees clear feedback on each result

**Journey**:
1. User drags multiple files to Documents page
   - Drag-over state: "Drop files to upload" overlay
   - Visual feedback: card becomes slightly transparent
2. User releases files
   - `handleUpload()` iterates files
   - Each file uploaded via `uploadDocument(file)`
   - **Not sequential**: could be parallel (check implementation)
   - Progress: No visible progress bar (upload is fast)
3. **Success case**:
   - All 10 files upload successfully
   - Documents appear in list immediately (optimistic update)
   - New docs appear at top (prepended to `documents` array)
   - View updates with new count: "Documents: 25 total"
4. **Partial failure case**:
   - 7 files succeed → appear in list
   - 3 files fail (e.g., network timeout, server error)
   - Each failed file:
     - Does NOT appear in list
     - Logged to console: "Failed to upload: file.name, error"
   - User sees no visual error message (implementation gap?)
   - List shows 17 new documents (7 successes)

**Error Scenarios**:
- File type not allowed (if enforced):
  - Server returns 400: `{ error: "Invalid file type", code: "VALIDATION_ERROR" }`
  - Upload hook catches error, logs to console
- File too large:
  - Server returns 413 or similar
  - Same handling: logged, not shown to user
- Network error:
  - Fetch fails, error caught
  - Same: logged, not shown
- Server error (500):
  - Returned as error response
  - Same handling

**Missing UX**:
- No visual error toast/banner for failed uploads
- User might not realize 3 files failed
- Recommendation: Add error toast for each failed file with retry option

**Implementation**:
- `useDocuments()` hook:
  ```ts
  const upload = useCallback(async (files: File[]) => {
    const uploaded: Document[] = [];
    for (const file of files) {
      try {
        const doc = await uploadDocument(file);
        uploaded.push(doc);
      } catch (err) {
        console.error('Failed to upload:', file.name, err);
        // TODO: show toast/banner
      }
    }
    if (uploaded.length > 0) {
      setDocuments(prev => [...uploaded, ...prev]);
    }
  }, []);
  ```

---

### 7. Open Document on System (MEDIUM)
**User**: Developer wanting to edit or view document in native app  
**Goal**: Launch document with system default application

**Context**:
- User prefers to edit Word docs in Microsoft Word, not in browser
- Document is stored locally at `~/.claude-tauri/documents/{id}{ext}`
- System has native handlers for file types

**Journey**:
1. User opens document preview modal (Story 3)
   - File type: `.docx` (Office document)
   - Modal shows fallback card: "Open on Computer" button
2. User clicks "Open on Computer"
   - Button calls `openDocumentOnComputer(doc.id)`
   - `POST /api/documents/{id}/open` request sent
3. Server handler:
   - Fetches document from DB
   - Spawns process: `Bun.spawn(['open', storagePath])`
   - Waits for process to exit
   - Returns `{ success: true }`
4. System behavior:
   - macOS: `open` command launches default app for file type
   - Document opens in native application (Word, Excel, etc.)
   - User can edit and save normally
5. User closes native app and returns to Documents view
   - No sync back to app (document on disk is now modified, but DB unchanged)
   - If user re-uploads: creates new document entry

**Alternative Access Points**:
- Context menu (Story 8): "Open on Computer" option
- Document card hover: "Open" button → opens preview modal first, then "Open on Computer" from modal
- Right-click → "Open on Computer" directly (if implemented)

**Error Handling**:
- Process spawn fails → `POST /api/documents/{id}/open` returns 500
- Error caught in `try/catch`, logged to console
- User sees no visual feedback (implementation gap?)
- Recommendation: Toast showing "Failed to open file"

**Platform Considerations**:
- macOS: `open` command works
- Linux: May need `xdg-open` or similar
- Windows: May need different approach
- Current code: assumes `open` is available (macOS-focused)

---

### 8. Document Context Menu Mastery (LONG)
**User**: Power user with 50+ documents, using documents as primary tool  
**Goal**: Access all document operations from right-click context menu

**Context**:
- User wants fast access without modal or button clicks
- Context menu supports:
  - Open (preview)
  - Open on Computer
  - Copy File Path
  - Download
  - Copy Link
  - Delete
  - Rename (disabled/TODO)

**Journey**:
1. User right-clicks a document (in gallery or table view)
   - Mouse position captured: `{ x, y }`
   - Context menu appears at cursor with:
     - "Open" — opens preview modal
     - "Open on Computer" — launches native app
     - "Copy File Path" — copies to clipboard: `/Users/.../.claude-tauri/documents/{id}.pdf`
     - Separator
     - "Download" — browser download
     - "Copy Link" — copies file URL: `http://localhost:3131/api/documents/{id}/file`
     - Separator
     - "Rename" — disabled (grayed out, no hover effect)
     - "Delete" — red text, destructive action

2. **Click "Open"**:
   - Menu closes
   - Preview modal opens (Story 3)
   - Document type detected and rendered

3. **Click "Open on Computer"**:
   - Calls `openDocumentOnComputer()` (Story 7)
   - Menu closes
   - System app launches

4. **Click "Copy File Path"**:
   - Gets document.storagePath from data
   - Calls `navigator.clipboard.writeText(storagePath)`
   - Menu closes
   - Path now in clipboard (e.g., for terminal use)
   - Hint: User can paste in terminal to access file: `cat /path/to/doc`

5. **Click "Download"**:
   - Creates invisible `<a>` element
   - Sets `href` to document file URL
   - Sets `download` attribute to filename
   - Clicks element → browser downloads
   - Menu closes
   - File saved to Downloads folder with original filename

6. **Click "Copy Link"**:
   - Gets file URL: `http://localhost:3131/api/documents/{id}/file`
   - Copies to clipboard
   - Menu closes
   - User can share/paste URL elsewhere

7. **Click "Rename"** (disabled):
   - Button is grayed out with 50% opacity
   - No click handler
   - Tooltip or status: "Coming soon" (future)

8. **Click "Delete"**:
   - Red text, distinct from other options
   - Calls `onDelete(doc.id)`
   - Menu closes
   - Document removed from DB and filesystem
   - List updates: document disappears
   - No confirmation dialog (see error handling below)

**Menu Positioning**:
- Appears at `(clientX, clientY)` from right-click event
- If near screen edge:
  - Adjusts X/Y to keep menu visible
  - Moves left if right edge exceeds viewport
  - Moves up if bottom edge exceeds viewport
  - Min padding: 8px from edge
- Menu stays fixed (doesn't follow scroll)

**Accessibility & Behavior**:
- Menu closes on:
  - Click outside menu
  - Click on menu item
  - Scroll in document
  - Escape key
- Menu contains:
  - Semantic button elements
  - No keyboard navigation (arrow keys) implemented yet
  - Hover states provide feedback
- Tooltips on hover (via title attribute) for long text

**Error Handling**:
- Copy to clipboard fails:
  - Handled with `catch`, but no user feedback
  - Recommendation: Toast showing "Failed to copy to clipboard"
- Delete fails:
  - `deleteDocument()` throws error
  - Caught in `handleDelete()`, logged
  - No visual feedback
  - Recommendation: Confirmation dialog + error toast

**Future Enhancements**:
- Rename: Enable full rename UI (inline edit or modal)
- Keyboard navigation: Arrow keys, Enter to select
- Confirmation for delete: "Are you sure?" dialog
- Tag editor: Right-click → "Add Tags"
- Move to folder: Organize into subdirectories (if implemented)

---

### 9. Gallery vs Table Views (LONG)
**User**: Developer switching between visual and data-driven browsing  
**Goal**: View documents as cards or detailed table based on task

**Context**:
- Two view modes available: Gallery (default) and Table
- Toggle in header right side
- Both modes show same document list

**Gallery View** (Visual Browsing):
1. Default view when opening Documents
   - Responsive grid layout:
     - Mobile (small): 2 columns
     - Tablet (md): 3 columns
     - Desktop (lg): 4 columns
     - Large (xl): 5 columns
   - Gap between cards: 1rem (16px)
2. Each card displays:
   - **Preview area** (36 height):
     - Image files: thumbnail preview (object-cover)
     - PDF: PDF icon (red)
     - Spreadsheet: Excel icon (emerald)
     - Code/Text: File icon (blue)
     - Generic: File icon (muted)
     - Hover: Download + Delete buttons appear (top-right)
   - **Info section**:
     - Filename (truncated, tooltip on hover)
     - File size (right-aligned)
     - Relative date (right-aligned)
   - Status badge (bottom-left if not 'ready'):
     - "uploading" (blue)
     - "processing" (amber)
     - "error" (red)
3. Hover states:
   - Card gains shadow + subtle border color change
   - Download icon (top-right): Click to download
   - Trash icon (top-right): Click to delete
4. Click anywhere on card → Preview modal opens
5. Right-click on card → Context menu (Story 8)

**Table View** (Data-Driven):
1. User clicks table view toggle in header
   - Grid layout replaced with table structure
2. Table columns:
   - Filename (left-aligned, sortable?)
   - Size (right-aligned)
   - Type (badge: PDF, Image, CSV, etc.)
   - Status (uploading/ready/error)
   - Date (relative, right-aligned)
3. Each row:
   - Click → Preview modal opens
   - Right-click → Context menu
   - Hover → Background slight color change
   - Row height: ~44px for readability
4. Sorting (future):
   - Click column header to sort
   - Ascending/descending toggle
   - Default: Created date (newest first)
5. Pagination (if many documents, future):
   - Show 50 per page
   - Next/Previous buttons
   - Or infinite scroll

**Switching Between Views**:
1. User clicks gallery icon → Gallery view active (button highlighted)
2. User clicks table icon → Table view active (button highlighted)
3. Same search/filter applies to both
4. View preference persists in session (localStorage, future)
5. Scroll position resets on toggle

**Search Behavior in Both Views**:
- Search input applies to both gallery and table
- Filters documents by filename (substring match)
- Empty search state shows all documents
- No results state: "No documents match your search"

**Empty States**:
- **Gallery** (no documents at all):
  - Large centered message: "No documents yet"
  - Upload icon placeholder
  - "Upload Document" button
- **Gallery** (search, no results):
  - Centered message: "No documents match your search"
  - "Try a different search term"
- **Table** (same as gallery)

**Performance Considerations**:
- Large document count (50+):
  - Gallery: CSS Grid renders efficiently
  - Table: Could benefit from virtualization (future)
  - Search: Real-time filtering may lag (consider debounce if 100+)

**Responsive Design**:
- Desktop (lg+): Full layout
- Tablet (md): Gallery 3 columns, table readable
- Mobile (sm): Gallery 2 columns, table horizontal scroll (if needed)
- Header always visible: Search + view toggle + upload

---

### 10. Large File Preview & Limits (LONG)
**User**: Data analyst working with large CSV exports and logs  
**Goal**: Preview content-heavy files without lag or crashes

**Context**:
- File size: 5MB CSV with 10,000 rows
- API has limit: Content preview limited to 500KB
- Graceful degradation for unsupported types

**Journey A: Large CSV File**:
1. User has uploaded a 5MB CSV (sales data, 10,000 rows)
   - Status: 'ready' (no processing)
   - MIME type: 'text/csv'
2. User opens preview modal
   - Server receives: `GET /api/documents/{id}/content`
   - Checks file size: 5MB > 500KB limit
   - Returns first 500KB of content + truncation notice
3. Frontend receives:
   ```
   Data...row 2450...
   
   ... (truncated, file is 5120 KB)
   ```
4. Modal shows CSV table:
   - Header row visible
   - Data rows displayed (approximately 2450 rows out of 10,000)
   - Status banner at bottom: "Showing first 500 of 10000 rows"
   - Colors: Alternating row backgrounds for readability
5. User can:
   - Scroll through visible rows
   - See file is truncated
   - Download full file: "Download" button → saves full 5MB file
   - Open on Computer: "Open on Computer" → opens in Excel

**Journey B: Large Log File**:
1. User has uploaded a 2MB `.log` file
2. Opens preview modal
   - Type detected as 'text' (based on `.log` extension)
   - Content endpoint returns 500KB + truncation
3. Modal shows text preview:
   ```
   [2026-03-23 14:32:01] INFO: Starting process...
   [2026-03-23 14:32:02] DEBUG: Connecting to DB...
   ...
   [2026-03-23 15:12:45] INFO: Process complete
   
   ... (truncated, file is 2048 KB)
   ```
4. User can scroll, search (Ctrl+F browser search)
   - Only visible content is searchable (not full file)
   - Recommendation: "Use 'Open on Computer' for full-text search"
5. User opens file in native text editor for full access

**Journey C: Large JSON (4MB)**:
1. User uploads 4MB JSON (API response dump)
2. Opens preview modal
   - Type: 'json'
   - Content fetched: 500KB limit applied
   - Returns truncated JSON (malformed at end)
3. Frontend tries `JSON.parse()` → fails (incomplete)
4. Falls back to displaying raw text
5. Modal shows: "... (truncated, file is 4096 KB)"
6. User can download or open in text editor for full view

**Journey D: Unsupported Large File**:
1. User uploads a 50MB `.zip` file
   - Status: 'ready'
   - MIME type: 'application/zip'
2. Opens preview modal
   - Type detected as 'unsupported'
   - No content fetch attempted (no text preview)
3. Modal shows fallback card:
   - Download icon
   - Filename + size (50 MB)
   - "Preview not available for this file type"
   - Buttons: "Open on Computer", "Download"
4. User clicks Download → saves 50MB file (browser handles large download)

**API Content Endpoint Limits**:
- Max content size: 500KB (500 * 1024 bytes)
- File size > limit:
  - Read first 500KB of file
  - Append: `\n\n... (truncated, file is XXXX KB)`
  - Return text with truncation notice
- Supported types for preview:
  - text/*, application/json, application/xml, application/x-yaml, etc.
  - Extensions: .md, .txt, .csv, .json, .py, .js, .ts, etc.
- Unsupported types (office, binary):
  - Return 415: "Preview not available for this file type"

**Performance & UX**:
- **Fast**: Previewing 500KB file is near-instant
- **Clear communication**: Truncation notice explains why content is incomplete
- **Fallback**: Download or open on computer always available
- **Accessibility**: Users with large files don't feel blocked
- **No browser crash**: Content limited prevents excessive rendering

**Error Scenarios**:
1. File deleted from disk while in preview:
   - Content fetch returns 404: "File not found on disk"
   - Modal shows error: "Failed to load content"
   - User can download or open on computer
2. File moved/corrupted:
   - Same 404 error handling
3. Disk I/O failure:
   - Server returns 500 error
   - Modal shows: "Failed to load content" + error message

**Future Enhancements**:
- Increase limit based on document type (e.g., 2MB for code files)
- Lazy load: Show first page, load more on scroll
- Syntax highlighting: Code files with proper highlighting
- Search within large files: Full-text search via indexing
- Compression: Automatically decompress .gz files before preview

---

## Summary & Insights

**Core Workflows**:
1. **Upload & organize**: Simple drag-drop or button, immediate visibility
2. **Find & browse**: Search, gallery/table views, preview any type
3. **Integrate with sessions**: Link documents for AI context
4. **Power user access**: Context menu, clipboard operations, native app integration

**UX Strengths**:
- Empty state guidance is clear
- Multiple preview types (image, PDF, text, CSV, JSON, code, markdown)
- Responsive gallery layout
- Keyboard shortcuts in modal (Esc, arrows, D for download)
- File type icons provide quick visual scanning

**UX Gaps** (Identified):
- No error toast for failed uploads (batch upload story)
- No confirmation dialog for delete
- No visual feedback for copy-to-clipboard operations
- Rename feature is disabled (future work)
- Tag management UI not fully specified
- Tagging/filtering by tags not implemented yet
- Document-session linking needs clarification (UI placement)

**Accessibility Opportunities**:
- Search results could have ARIA live region
- Context menu lacks keyboard navigation
- Modal heading level hierarchy
- File type badges could have more semantic meaning

**File Size & Performance**:
- Content preview capped at 500KB (prevents lag)
- Large file downloads handled by browser
- Graceful truncation notice for files > limit
- Office documents gracefully degrade to download/open options

---


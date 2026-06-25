# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run lint          # ESLint check (runs automatically before tests)
npm test              # Full test suite inside VS Code Extension Host (requires GUI)
```

To run only the pure unit tests without launching VS Code:
```bash
node -e "const {formatDuration,isVideoId,isYouTubeUrl}=require('./lib/utils'); ..."
```

To launch the extension in development:
- Press **F5** in VS Code — launches a new Extension Development Host window via `.vscode/launch.json`

To verify yt-dlp works:
```bash
yt-dlp --version
yt-dlp -f "18" --get-url --no-playlist "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

## Architecture

```
extension.js      VS Code entry point — activate/deactivate, command registration,
                  YouTubeViewProvider (sidebar webview), getFloatingPlayerContent()
lib/utils.js      Pure logic with no VS Code dependency — yt-dlp subprocess wrappers,
                  URL helpers, search result parsing. Imported by both extension.js and tests.
test/extension.test.js   Mocha suite run via @vscode/test-cli inside an Extension Host
```

### How video playback works

1. User submits input in the sidebar webview → `vscode.postMessage` to the extension host
2. Extension host detects intent in `resolveWebviewView` message handler:
   - YouTube URL or 11-char video ID → calls `getStreamUrl(videoId)` in `lib/utils.js`
   - Anything else → calls `searchYoutube(query)` in `lib/utils.js`
3. `getStreamUrl` spawns `yt-dlp --get-url` to resolve a signed Google CDN URL
4. The URL is posted back to the webview and set as `<video src="...">` — no proxy, no iframe
5. The CDN URL supports `Accept-Ranges: bytes` so seeking works natively

### Webview ↔ Extension Host message protocol

| Direction | `command` | Payload |
|---|---|---|
| webview → host | `loadVideo` | `{ videoId }` |
| webview → host | `search` | `{ query }` |
| webview → host | `popOut` | — |
| host → webview | `loading` | `{ videoId }` |
| host → webview | `videoReady` | `{ url, videoId }` |
| host → webview | `videoError` | `{ error }` |
| host → webview | `searching` | — |
| host → webview | `searchResults` | `{ results[] }` |
| host → webview | `searchError` | `{ error }` |

### Content Security Policy

Both the sidebar and floating player webviews use:
```
media-src https:        — allows *.googlevideo.com CDN URLs in <video>
img-src https://i.ytimg.com  — search result thumbnails (sidebar only)
script-src 'unsafe-inline'   — inline <script> in webview HTML
```

No `frame-src` — YouTube iframes are intentionally removed.

### yt-dlp format selection

`lib/utils.js` requests format `18/best[ext=mp4][height<=720]/best[ext=mp4]/best`:
- Format `18` = 360p progressive MP4 with audio+video in a single file (no ffmpeg merge needed)
- Falls back to any single-file MP4 up to 720p, then any best available

If yt-dlp returns two URLs (DASH video + audio), only the first is used — avoid `+` combined formats.

### External dependency

`yt-dlp` must be installed on the user's machine (`brew install yt-dlp`). The extension has no npm runtime dependencies. If `yt-dlp` is missing, `spawn` emits `ENOENT` which is caught and surfaced as a friendly error in the webview.

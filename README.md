# VS Code YouTube Player Extension

Watch YouTube videos directly in VS Code without leaving your coding environment. Uses **yt-dlp** to stream videos natively — no browser, no iframe, no YouTube policy blocks.

## Features

- **Search YouTube** — type any keyword in the input field to search and browse results with thumbnails, channel names, and durations
- **Play by URL or ID** — paste a `youtube.com` URL, a `youtu.be` short link, or a bare video ID to play instantly
- **Native video playback** — streams via `yt-dlp`; plays in a native `<video>` element with full seek, pause, and volume controls
- **Floating player** — pop out the player into a side panel so it stays visible while you code
- **Watch history** — your last 5 videos are saved and shown for quick replay

## Requirements

### yt-dlp (required)

yt-dlp is a command-line tool used to resolve YouTube stream URLs. You must install it before videos will play.

**macOS (Homebrew):**
```bash
brew install yt-dlp
```

**Windows / Linux:**
```bash
pip install yt-dlp
```

Or download the standalone binary from [github.com/yt-dlp/yt-dlp/releases](https://github.com/yt-dlp/yt-dlp/releases).

**Verify installation:**
```bash
yt-dlp --version
```

**Keep yt-dlp up to date** (YouTube changes its internals frequently):
```bash
yt-dlp -U
# or
brew upgrade yt-dlp
```

> If videos stop playing, run `yt-dlp -U` to update — this fixes most breakages.

## Installation

1. Install yt-dlp (see above)
2. Install this extension from the VS Code Marketplace
3. Click the YouTube icon in the activity bar

## Usage

### Search for videos

Type any keyword into the input field and press **Enter** or click **Go**.  
Search results appear below the player with thumbnails, channel, and duration.  
Click any result to start playing.

### Play a specific video

Paste a YouTube URL or video ID into the input field and press **Enter**:

```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ
dQw4w9WgXcQ
```

The extension auto-detects whether the input is a search query or a direct link.

### Pop Out player

Click the **Pop Out** button to open the video in a floating panel beside your editor. Useful for keeping the video visible while browsing code.

### Watch history

Your last 5 played videos are shown below the player. Click any thumbnail to replay.

## How it works

1. When you play a video, the extension calls `yt-dlp` in the background to resolve a signed, time-limited stream URL directly from YouTube's CDN
2. The URL is fed into a native HTML `<video>` element inside the VS Code webview
3. The CDN supports HTTP range requests, so **seeking works** without buffering the whole video

This approach bypasses the `vscode-webview://` sandbox restrictions that block YouTube iframes.

## VS Code Requirements

- VS Code 1.54.0 or higher
- Internet connection

## Troubleshooting

| Symptom | Fix |
|---|---|
| "yt-dlp not found" | Install yt-dlp: `brew install yt-dlp` |
| Video won't load / error from yt-dlp | Update yt-dlp: `yt-dlp -U` |
| Search returns no results | Check your internet connection |
| Video plays but no audio | The stream format may not include audio; try a different video to confirm |

## Release Notes

### 0.0.3

- Replaced YouTube iframe embed with native `yt-dlp`-powered streaming
- Added YouTube keyword search with thumbnail results
- Smart input: auto-detects URL, video ID, or search query
- Seeking now works via HTTP range requests to YouTube's CDN

### 0.0.1

- Initial release with sidebar and floating player

## Legal Disclaimer

This extension is intended as a **personal productivity and developer tool** only.

- This extension does not download, store, or redistribute any YouTube content
- You are responsible for ensuring your use complies with [YouTube's Terms of Service](https://www.youtube.com/t/terms)
- Only watch content you have the right to access (your own uploads, Creative Commons videos, or videos explicitly permitted for third-party playback)
- The authors of this extension are not affiliated with YouTube or Google
- Use at your own risk

## Privacy

This extension streams video directly from YouTube's CDN via yt-dlp. No data is sent to any third-party server. Your usage is subject to YouTube's Terms of Service.

## License

MIT

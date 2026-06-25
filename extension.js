const vscode = require('vscode');
const { getStreamUrl, searchYoutube, isVideoId, isYouTubeUrl } = require('./lib/utils');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const state = { currentVideoId: null, currentStreamUrl: null, floatingPanel: null };
    global.state = state;

    const provider = new YouTubeViewProvider(context.extensionUri, state);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('youtube-player', provider)
    );

    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(editors => {
            if (editors.length === 0 && state.floatingPanel) {
                setTimeout(() => {
                    if (vscode.window.visibleTextEditors.length === 0 && state.floatingPanel) {
                        state.floatingPanel.dispose();
                    }
                }, 500);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('yt.openVideoPlayer', () => {
            vscode.commands.executeCommand('youtube-player.focus');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('yt.createFloatingPlayer', () => {
            if (state.floatingPanel) {
                state.floatingPanel.reveal(vscode.ViewColumn.Beside);
                return;
            }
            const panel = vscode.window.createWebviewPanel(
                'youtubeFloatingPlayer', 'YouTube Player',
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );
            state.floatingPanel = panel;
            panel.webview.html = getFloatingPlayerContent(state.currentStreamUrl, state.currentVideoId);
            panel.onDidDispose(() => { state.floatingPanel = null; });
            panel.webview.onDidReceiveMessage(msg => {
                if (msg.command === 'minimize') panel.dispose();
            });
        })
    );
}

function getFloatingPlayerContent(streamUrl, videoId) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src https:; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
    <style>
        body { margin:0; background:#000; display:flex; flex-direction:column; height:100vh; color:#d4d4d4; font-family:sans-serif; }
        .toolbar { background:#1e1e1e; padding:5px 10px; display:flex; align-items:center; gap:8px; font-size:12px; }
        button { background:#0e639c; color:white; border:none; padding:4px 10px; border-radius:3px; cursor:pointer; font-size:12px; }
        button:hover { background:#1177bb; }
        .video-wrap { flex:1; display:flex; align-items:center; justify-content:center; background:#000; }
        video { max-width:100%; max-height:100%; width:100%; }
        .placeholder { color:#666; font-size:14px; text-align:center; padding:20px; }
    </style>
</head>
<body>
    <div class="toolbar">
        <span style="opacity:0.7;flex:1">${videoId ? `Video: ${videoId}` : 'No video loaded'}</span>
        <button onclick="(acquireVsCodeApi)().postMessage({command:'minimize'})">Close</button>
    </div>
    <div class="video-wrap">
        ${streamUrl
            ? `<video src="${streamUrl}" controls autoplay></video>`
            : `<div class="placeholder">Load a video from the sidebar player first</div>`}
    </div>
</body>
</html>`;
}

class YouTubeViewProvider {
    constructor(extensionUri, state) {
        this.extensionUri = extensionUri;
        this.state = state;
    }

    /** @param {vscode.WebviewView} webviewView */
    resolveWebviewView(webviewView) {
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] };
        webviewView.webview.html = this._getHtml();

        webviewView.webview.onDidReceiveMessage(async msg => {
            if (msg.command === 'loadVideo') {
                this.state.currentVideoId = msg.videoId;
                webviewView.webview.postMessage({ command: 'loading', videoId: msg.videoId });
                try {
                    const url = await getStreamUrl(msg.videoId);
                    this.state.currentStreamUrl = url;
                    webviewView.webview.postMessage({ command: 'videoReady', url, videoId: msg.videoId });
                    if (this.state.floatingPanel) {
                        this.state.floatingPanel.webview.html = getFloatingPlayerContent(url, msg.videoId);
                    }
                } catch (err) {
                    webviewView.webview.postMessage({ command: 'videoError', error: err.message });
                }
            } else if (msg.command === 'search') {
                webviewView.webview.postMessage({ command: 'searching' });
                try {
                    const results = await searchYoutube(msg.query);
                    webviewView.webview.postMessage({ command: 'searchResults', results });
                } catch (err) {
                    webviewView.webview.postMessage({ command: 'searchError', error: err.message });
                }
            } else if (msg.command === 'popOut') {
                vscode.commands.executeCommand('yt.createFloatingPlayer');
            }
        });
    }

    _getHtml() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src https:; img-src https://i.ytimg.com; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
    <style>
        * { box-sizing:border-box; margin:0; padding:0; }
        body {
            background:var(--vscode-sideBar-background,#1e1e1e);
            color:var(--vscode-foreground,#d4d4d4);
            font-family:var(--vscode-font-family,sans-serif);
            font-size:13px;
            height:100vh;
            display:flex;
            flex-direction:column;
            overflow:hidden;
        }
        .container { display:flex; flex-direction:column; height:100%; gap:8px; padding:8px; overflow:hidden; }

        /* ── input row ── */
        .input-row { display:flex; gap:6px; flex-shrink:0; }
        .url-input {
            flex:1;
            background:var(--vscode-input-background,#3c3c3c);
            color:var(--vscode-input-foreground,#d4d4d4);
            border:1px solid var(--vscode-input-border,#555);
            border-radius:3px;
            padding:5px 8px;
            font-size:12px;
            outline:none;
        }
        .url-input:focus { border-color:var(--vscode-focusBorder,#007fd4); }
        .btn {
            background:var(--vscode-button-background,#0e639c);
            color:var(--vscode-button-foreground,white);
            border:none; border-radius:3px;
            padding:5px 10px; cursor:pointer; font-size:12px; white-space:nowrap;
        }
        .btn:hover { background:var(--vscode-button-hoverBackground,#1177bb); }
        .btn:disabled { opacity:0.5; cursor:default; }

        /* ── alerts ── */
        .error-msg {
            display:none; flex-shrink:0;
            color:#f48771; background:rgba(255,100,100,0.1);
            border:1px solid #f48771; border-radius:3px;
            padding:6px 8px; font-size:11px; line-height:1.4; word-break:break-word;
        }

        /* ── video area ── */
        .video-container {
            position:relative; width:100%; aspect-ratio:16/9;
            background:#000; border-radius:4px; overflow:hidden; flex-shrink:0;
        }
        video { width:100%; height:100%; display:none; }
        .placeholder {
            position:absolute; inset:0;
            display:flex; flex-direction:column; align-items:center; justify-content:center;
            gap:8px; color:#555;
        }
        .placeholder svg { width:40px; height:40px; fill:currentColor; }
        .placeholder-text { font-size:11px; }
        .spinner-overlay {
            display:none; position:absolute; inset:0;
            align-items:center; justify-content:center;
            background:rgba(0,0,0,0.65); flex-direction:column; gap:8px;
            color:white; font-size:12px;
        }
        .spinner {
            width:26px; height:26px;
            border:3px solid rgba(255,255,255,0.2); border-top-color:#fff;
            border-radius:50%; animation:spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform:rotate(360deg); } }

        /* ── action buttons ── */
        .action-row { display:flex; gap:6px; flex-shrink:0; }

        /* ── search results ── */
        #results-section {
            display:none; flex-direction:column; gap:6px;
            overflow-y:auto; flex:1;
        }
        .results-heading {
            font-size:10px; text-transform:uppercase; opacity:0.45;
            letter-spacing:0.06em; flex-shrink:0;
        }
        .results-list { list-style:none; display:flex; flex-direction:column; gap:3px; }
        .result-item {
            display:flex; align-items:flex-start; gap:8px;
            cursor:pointer; padding:5px; border-radius:3px;
        }
        .result-item:hover { background:rgba(255,255,255,0.07); }
        .result-item img {
            width:72px; height:40px; object-fit:cover;
            border-radius:2px; flex-shrink:0; background:#333;
        }
        .result-info { overflow:hidden; flex:1; }
        .result-title { font-size:11px; line-height:1.3; margin-bottom:2px; }
        .result-meta { font-size:10px; opacity:0.5; display:flex; gap:6px; }

        /* ── history ── */
        #history-section {
            display:none; flex-direction:column; gap:6px;
            overflow-y:auto; flex:1;
        }
        .history-heading { font-size:10px; text-transform:uppercase; opacity:0.45; letter-spacing:0.06em; }
        .history-list { list-style:none; display:flex; flex-direction:column; gap:3px; }
        .history-item {
            display:flex; align-items:center; gap:8px;
            cursor:pointer; padding:4px; border-radius:3px;
        }
        .history-item:hover { background:rgba(255,255,255,0.07); }
        .history-item img { width:60px; height:34px; object-fit:cover; border-radius:2px; flex-shrink:0; }
        .history-item-info { overflow:hidden; }
        .history-item-title { font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .history-item-id { font-size:10px; opacity:0.45; }

        /* searching spinner */
        .searching-row {
            display:none; align-items:center; gap:8px;
            font-size:11px; opacity:0.65; padding:4px 0; flex-shrink:0;
        }
        .mini-spinner {
            width:14px; height:14px;
            border:2px solid rgba(255,255,255,0.2); border-top-color:#fff;
            border-radius:50%; animation:spin 0.8s linear infinite; flex-shrink:0;
        }
    </style>
</head>
<body>
<div class="container">
    <div class="input-row">
        <input class="url-input" id="url" type="text"
               placeholder="Search or paste YouTube URL / ID"
               onkeydown="if(event.key==='Enter') handleInput()">
        <button class="btn" id="action-btn" onclick="handleInput()">Go</button>
    </div>

    <div id="error-msg" class="error-msg"></div>

    <div class="video-container">
        <div id="placeholder" class="placeholder">
            <svg viewBox="0 0 24 24">
                <path d="M10,15L15.19,12L10,9V15M21.56,7.17C21.69,7.64 21.78,8.27 21.84,9.07C21.91,9.87 21.94,10.56 21.94,11.16L22,12C22,14.19 21.84,15.8 21.56,16.83C21.31,17.73 20.73,18.31 19.83,18.56C19.36,18.69 18.5,18.78 17.18,18.84C15.88,18.91 14.69,18.94 13.59,18.94L12,19C7.81,19 5.2,18.84 4.17,18.56C3.27,18.31 2.69,17.73 2.44,16.83C2.31,16.36 2.22,15.73 2.16,14.93C2.09,14.13 2.06,13.44 2.06,12.84L2,12C2,9.81 2.16,8.2 2.44,7.17C2.69,6.27 3.27,5.69 4.17,5.44C4.64,5.31 5.5,5.22 6.82,5.16C8.12,5.09 9.31,5.06 10.41,5.06L12,5C16.19,5 18.8,5.16 19.83,5.44C20.73,5.69 21.31,6.27 21.56,7.17Z"/>
            </svg>
            <div class="placeholder-text">Search or paste a YouTube URL</div>
        </div>
        <div id="video-spinner" class="spinner-overlay">
            <div class="spinner"></div>
            <span>Fetching stream…</span>
        </div>
        <video id="player" controls></video>
    </div>

    <div class="action-row">
        <button class="btn" onclick="popOut()">
            <svg style="width:11px;height:11px;vertical-align:middle;fill:currentColor;margin-right:3px" viewBox="0 0 24 24">
                <path d="M19,19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M13.96,12.29L11.21,15.83L9.25,13.47L6.5,17H17.5L13.96,12.29Z"/>
            </svg>
            Pop Out
        </button>
    </div>

    <div style="font-size:9px;opacity:0.35;line-height:1.4;padding:2px 0;flex-shrink:0">
        For personal use only. Ensure your usage complies with
        <a href="https://www.youtube.com/t/terms" style="color:inherit">YouTube's Terms of Service</a>.
    </div>

    <div id="searching-row" class="searching-row">
        <div class="mini-spinner"></div>
        <span>Searching YouTube…</span>
    </div>

    <!-- search results -->
    <div id="results-section">
        <div class="results-heading">Search Results</div>
        <ul class="results-list" id="results-list"></ul>
    </div>

    <!-- watch history (shown when no search results) -->
    <div id="history-section">
        <div class="history-heading">Recently Watched</div>
        <ul class="history-list" id="history-list"></ul>
    </div>
</div>

<script>
    const vscode = acquireVsCodeApi();
    const MAX_HISTORY = 5;
    let watchHistory = [];

    try {
        const saved = localStorage.getItem('yt-history');
        if (saved) { watchHistory = JSON.parse(saved); renderHistory(); }
    } catch (e) {}

    /* ── input detection ── */
    function isYouTubeUrl(s) { return s.includes('youtube.com') || s.includes('youtu.be'); }
    function isVideoId(s) { return /^[A-Za-z0-9_-]{11}$/.test(s.trim()); }

    function extractVideoId(input) {
        try {
            if (input.includes('youtube.com')) return new URL(input).searchParams.get('v');
            if (input.includes('youtu.be')) return input.split('/').pop().split('?')[0];
        } catch (e) {}
        return input.trim();
    }

    function handleInput() {
        const raw = document.getElementById('url').value.trim();
        if (!raw) return;
        hideError();

        if (isYouTubeUrl(raw) || isVideoId(raw)) {
            const videoId = extractVideoId(raw);
            if (!videoId) { showError('Could not extract a video ID from that URL.'); return; }
            clearResults();
            loadVideo(videoId);
        } else {
            doSearch(raw);
        }
    }

    /* ── play a video by ID ── */
    function loadVideo(videoId) {
        document.getElementById('action-btn').disabled = true;
        vscode.postMessage({ command: 'loadVideo', videoId });
    }

    /* ── search ── */
    function doSearch(query) {
        document.getElementById('action-btn').disabled = true;
        vscode.postMessage({ command: 'search', query });
    }

    function clearResults() {
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('results-list').innerHTML = '';
    }

    /* ── pop out ── */
    function popOut() { vscode.postMessage({ command: 'popOut' }); }

    /* ── UI helpers ── */
    function showError(msg) {
        const el = document.getElementById('error-msg');
        el.textContent = msg;
        el.style.display = 'block';
        document.getElementById('action-btn').disabled = false;
    }
    function hideError() { document.getElementById('error-msg').style.display = 'none'; }
    function setVideoSpinner(show) {
        document.getElementById('video-spinner').style.display = show ? 'flex' : 'none';
    }
    function setSearchSpinner(show) {
        document.getElementById('searching-row').style.display = show ? 'flex' : 'none';
    }

    /* ── messages from extension host ── */
    window.addEventListener('message', event => {
        const msg = event.data;

        if (msg.command === 'loading') {
            setVideoSpinner(true);
            document.getElementById('placeholder').style.display = 'none';
        }

        if (msg.command === 'videoReady') {
            setVideoSpinner(false);
            document.getElementById('action-btn').disabled = false;
            const video = document.getElementById('player');
            video.src = msg.url;
            video.style.display = 'block';
            video.play().catch(() => {});
            addToHistory(msg.videoId);
            clearResults();
            showHistory();
        }

        if (msg.command === 'videoError') {
            setVideoSpinner(false);
            document.getElementById('placeholder').style.display = 'flex';
            showError('Playback error: ' + msg.error);
        }

        if (msg.command === 'searching') {
            setSearchSpinner(true);
            clearResults();
            document.getElementById('history-section').style.display = 'none';
        }

        if (msg.command === 'searchResults') {
            setSearchSpinner(false);
            document.getElementById('action-btn').disabled = false;
            renderResults(msg.results);
        }

        if (msg.command === 'searchError') {
            setSearchSpinner(false);
            document.getElementById('action-btn').disabled = false;
            showError('Search error: ' + msg.error);
        }
    });

    /* ── render search results ── */
    function renderResults(results) {
        const section = document.getElementById('results-section');
        const list = document.getElementById('results-list');

        if (!results || results.length === 0) {
            showError('No results found.');
            return;
        }

        list.innerHTML = results.map(r => \`
            <li class="result-item" data-id="\${escHtml(r.id)}" data-title="\${escHtml(r.title)}">
                <img src="\${r.thumbnail}" alt="" loading="lazy">
                <div class="result-info">
                    <div class="result-title">\${escHtml(r.title)}</div>
                    <div class="result-meta">
                        \${r.channel ? '<span>' + escHtml(r.channel) + '</span>' : ''}
                        \${r.duration ? '<span>' + escHtml(r.duration) + '</span>' : ''}
                    </div>
                </div>
            </li>
        \`).join('');

        list.onclick = e => {
            const item = e.target.closest('.result-item');
            if (item) onResultClick(item.dataset.id, item.dataset.title);
        };

        section.style.display = 'flex';
    }

    function escHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function onResultClick(videoId, title) {
        // Put the title in the input so the user sees what's playing
        document.getElementById('url').value = title;
        loadVideo(videoId);
    }

    /* ── history ── */
    function addToHistory(videoId) {
        watchHistory = watchHistory.filter(v => v.id !== videoId);
        watchHistory.unshift({
            id: videoId,
            thumbnail: \`https://i.ytimg.com/vi/\${videoId}/mqdefault.jpg\`,
            title: videoId
        });
        if (watchHistory.length > MAX_HISTORY) watchHistory.pop();
        try { localStorage.setItem('yt-history', JSON.stringify(watchHistory)); } catch (e) {}
    }

    function showHistory() {
        renderHistory();
        document.getElementById('history-section').style.display =
            watchHistory.length > 0 ? 'flex' : 'none';
    }

    function renderHistory() {
        const list = document.getElementById('history-list');
        list.innerHTML = watchHistory.map(v => \`
            <li class="history-item" onclick="loadVideo('\${v.id}')">
                <img src="\${v.thumbnail}" alt="" loading="lazy">
                <div class="history-item-info">
                    <div class="history-item-title">\${escHtml(v.title)}</div>
                    <div class="history-item-id">\${v.id}</div>
                </div>
            </li>
        \`).join('');
        if (watchHistory.length > 0) {
            document.getElementById('history-section').style.display = 'flex';
        }
    }

    // show history on load
    showHistory();
</script>
</body>
</html>`;
    }
}

function deactivate() {
    if (global.state && global.state.floatingPanel) {
        global.state.floatingPanel.dispose();
    }
}

module.exports = { activate, deactivate, getStreamUrl, searchYoutube, formatDuration, isVideoId, isYouTubeUrl };

const { spawn } = require('child_process');

function ytdlp(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn('yt-dlp', args);
        let stdout = '', stderr = '';
        proc.stdout.on('data', d => stdout += d.toString());
        proc.stderr.on('data', d => stderr += d.toString());
        proc.on('error', err => {
            reject(err.code === 'ENOENT'
                ? new Error('yt-dlp not found. Install it: brew install yt-dlp')
                : err);
        });
        proc.on('close', code => {
            if (code !== 0) reject(new Error(stderr.trim() || `yt-dlp exited ${code}`));
            else resolve(stdout);
        });
    });
}

async function getStreamUrl(videoId) {
    const out = await ytdlp([
        '-f', '18/best[ext=mp4][height<=720]/best[ext=mp4]/best',
        '--print', '%(title)s',
        '--print', '%(url)s',
        '--no-playlist',
        `https://www.youtube.com/watch?v=${videoId}`
    ]);
    const lines = out.trim().split('\n');
    const url = lines.find(l => l.startsWith('http'));
    if (!url) throw new Error('yt-dlp returned no stream URL');
    // Title is the first line that isn't the URL
    const title = lines.find(l => !l.startsWith('http')) || videoId;
    return { url, title };
}

async function searchYoutube(query) {
    const out = await ytdlp([
        `ytsearch10:${query}`,
        '--flat-playlist', '-j', '--no-playlist'
    ]);
    return out.trim().split('\n')
        .filter(Boolean)
        .map(line => {
            try {
                const r = JSON.parse(line);
                return {
                    id: r.id,
                    title: r.title,
                    channel: r.channel || r.uploader || '',
                    duration: r.duration ? formatDuration(r.duration) : '',
                    thumbnail: `https://i.ytimg.com/vi/${r.id}/mqdefault.jpg`
                };
            } catch { return null; }
        })
        .filter(Boolean);
}

function formatDuration(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function isVideoId(input) {
    return /^[A-Za-z0-9_-]{11}$/.test(input.trim());
}

function isYouTubeUrl(input) {
    return input.includes('youtube.com') || input.includes('youtu.be');
}

module.exports = { ytdlp, getStreamUrl, searchYoutube, formatDuration, isVideoId, isYouTubeUrl };

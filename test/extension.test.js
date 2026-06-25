const assert = require('assert');
const vscode = require('vscode');
const { formatDuration, isVideoId, isYouTubeUrl, getStreamUrl, searchYoutube } = require('../lib/utils');

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    // ── formatDuration ─────────────────────────────────────────────────────────

    suite('formatDuration', () => {
        test('formats seconds only', () => {
            assert.strictEqual(formatDuration(45), '0:45');
        });

        test('formats minutes and seconds', () => {
            assert.strictEqual(formatDuration(90), '1:30');
        });

        test('pads seconds below 10', () => {
            assert.strictEqual(formatDuration(65), '1:05');
        });

        test('formats hours correctly', () => {
            assert.strictEqual(formatDuration(3661), '1:01:01');
        });

        test('formats long videos (24h)', () => {
            assert.strictEqual(formatDuration(86400), '24:00:00');
        });
    });

    // ── isVideoId ──────────────────────────────────────────────────────────────

    suite('isVideoId', () => {
        test('accepts a valid 11-char video ID', () => {
            assert.strictEqual(isVideoId('dQw4w9WgXcQ'), true);
        });

        test('accepts IDs with underscores and hyphens', () => {
            assert.strictEqual(isVideoId('abc-DEF_123'), true);
        });

        test('rejects IDs shorter than 11 chars', () => {
            assert.strictEqual(isVideoId('short'), false);
        });

        test('rejects IDs longer than 11 chars', () => {
            assert.strictEqual(isVideoId('dQw4w9WgXcQExtra'), false);
        });

        test('rejects a full YouTube URL', () => {
            assert.strictEqual(isVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), false);
        });

        test('rejects strings with spaces', () => {
            assert.strictEqual(isVideoId('lo fi music'), false);
        });

        test('rejects empty string', () => {
            assert.strictEqual(isVideoId(''), false);
        });
    });

    // ── isYouTubeUrl ───────────────────────────────────────────────────────────

    suite('isYouTubeUrl', () => {
        test('detects youtube.com watch URL', () => {
            assert.strictEqual(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
        });

        test('detects youtu.be short URL', () => {
            assert.strictEqual(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ'), true);
        });

        test('detects youtube.com without www', () => {
            assert.strictEqual(isYouTubeUrl('youtube.com/watch?v=abc'), true);
        });

        test('returns false for a plain search query', () => {
            assert.strictEqual(isYouTubeUrl('lo-fi coding music'), false);
        });

        test('returns false for a bare video ID', () => {
            assert.strictEqual(isYouTubeUrl('dQw4w9WgXcQ'), false);
        });

        test('returns false for another video site', () => {
            assert.strictEqual(isYouTubeUrl('https://vimeo.com/123456'), false);
        });
    });

    // ── getStreamUrl (integration — requires yt-dlp + network) ────────────────

    suite('getStreamUrl', function () {
        this.timeout(30000);

        test('returns an HTTPS stream URL for a known video', async () => {
            const url = await getStreamUrl('dQw4w9WgXcQ');
            assert.ok(url.startsWith('https://'), `Expected HTTPS URL, got: ${url}`);
        });

        test('returned URL contains video/mp4 mime type indicator', async () => {
            const url = await getStreamUrl('dQw4w9WgXcQ');
            assert.ok(
                url.includes('mime=video%2Fmp4') || url.includes('.mp4'),
                `Expected mp4 URL, got: ${url}`
            );
        });

        test('throws a descriptive error for an invalid video ID', async () => {
            await assert.rejects(
                () => getStreamUrl('invalidIDhere'),
                err => {
                    assert.ok(err instanceof Error);
                    assert.ok(err.message.length > 0);
                    return true;
                }
            );
        });
    });

    // ── searchYoutube (integration — requires yt-dlp + network) ───────────────

    suite('searchYoutube', function () {
        this.timeout(30000);

        test('returns an array of results', async () => {
            const results = await searchYoutube('lo-fi coding music');
            assert.ok(Array.isArray(results));
            assert.ok(results.length > 0, 'Expected at least one search result');
        });

        test('each result has required fields', async () => {
            const results = await searchYoutube('javascript tutorial');
            for (const r of results) {
                assert.ok(typeof r.id === 'string' && r.id.length > 0, 'Missing id');
                assert.ok(typeof r.title === 'string' && r.title.length > 0, 'Missing title');
                assert.ok(typeof r.thumbnail === 'string' && r.thumbnail.startsWith('https://'), 'Missing thumbnail');
                assert.ok(typeof r.channel === 'string', 'Missing channel');
                assert.ok(typeof r.duration === 'string', 'Missing duration');
            }
        });

        test('thumbnail URLs follow the expected ytimg.com pattern', async () => {
            const results = await searchYoutube('vs code tips');
            for (const r of results) {
                assert.match(
                    r.thumbnail,
                    /^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]+\/mqdefault\.jpg$/
                );
            }
        });

        test('returns at most 10 results', async () => {
            const results = await searchYoutube('music');
            assert.ok(results.length <= 10, `Expected <= 10 results, got ${results.length}`);
        });

        test('duration strings are formatted correctly (M:SS or H:MM:SS)', async () => {
            const results = await searchYoutube('short video');
            const durationPattern = /^\d+:\d{2}(:\d{2})?$/;
            for (const r of results) {
                if (r.duration) {
                    assert.match(r.duration, durationPattern, `Bad duration format: ${r.duration}`);
                }
            }
        });
    });

    // ── Extension activation ───────────────────────────────────────────────────

    suite('Extension activation', () => {
        test('extension activates without error', async () => {
            const ext = vscode.extensions.getExtension('kartikgangil.youtube-player');
            if (ext) {
                await ext.activate();
                assert.ok(ext.isActive);
            } else {
                // Running outside the extension host — skip gracefully
                assert.ok(true, 'Extension not found in host; skipping activation test');
            }
        });

        test('yt.openVideoPlayer command is registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('yt.openVideoPlayer'),
                'Command yt.openVideoPlayer not registered'
            );
        });

        test('yt.createFloatingPlayer command is registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('yt.createFloatingPlayer'),
                'Command yt.createFloatingPlayer not registered'
            );
        });
    });
});

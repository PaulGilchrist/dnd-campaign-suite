/**
 * Offline-ambience upload lane (backlog Item 3, 2026-11-25) — locally-hosted
 * audio files per campaign, so a table without internet access gets
 * ambience too.
 *
 * POST   /api/campaigns/:campaign/audio        { audio: <base64 data URL>, fileName }
 *   → { src: 'audio/amb-<ts>-<rand>.<ext>', title }
 * DELETE /api/campaigns/:campaign/audio/:file  → { deleted: true }
 *
 * Mirrors the token-art upload doctrine (server/routes/token-image.js and
 * server/utils/imageUtils.js): the base64 lives ONLY in this POST body, disk
 * gets the decoded bytes under the campaign's audio/ directory, and the music
 * override row stores just the campaign-relative PATH. Serving is the plain
 * express.static(public/) lane in server.js — no GET route needed.
 *
 * GM-only (gmGuard.isLocalhost — the canonical new-gate home, NOT a copied
 * predicate): this lane writes files into the GM machine's disk. Track-list
 * editing stays delegable to players through the shared /music lane; the
 * FILES are a GM-machine capability. LAN-origin requests get the same 403
 * copy every sibling image lane uses.
 *
 * File-type law (server-enforced, plain-English 400s naming the offender):
 * mp3/ogg/oga/m4a/wav by extension, and the data URL's audio/<subtype> must
 * plausibly match the extension (browsers stamp these from the file itself).
 * Transport size hygiene is the app-wide 5 MB JSON body limit; the client
 * pre-checks ~3.5 MB so an over-large file gets a named refusal instead of a
 * parser-level 413.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { campaignDir, campaignAudioDir } from '../utils/campaignPaths.js';
import { isLocalhost } from '../utils/gmGuard.js';
import { AUDIO_EXTENSIONS_HELP, AUDIO_FILE_PATTERN, newAudioFileName } from '../utils/campaignAudio.js';

const router = express.Router();

// Extension → audio data-URL subtypes browsers produce for that container.
const ALLOWED_EXT = new Map([
  ['.mp3', ['mpeg', 'mp3']],
  ['.ogg', ['ogg', 'oga', 'opus']],
  ['.oga', ['ogg', 'oga', 'opus']],
  ['.m4a', ['mp4', 'x-m4a', 'aac', 'm4a']],
  ['.wav', ['wav', 'x-wav', 'wave']],
]);

// data-URL gate first: this route exists solely for FileReader payloads.
function decodeAudioDataUrl(audio) {
    const m = typeof audio === 'string' && audio.match(/^data:audio\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
    return m ? { subtype: m[1].toLowerCase(), base64: m[2] } : null;
}

// Display title from the client filename: basename only (strip any path the
// File API may carry), extension dropped, capped so one row cannot bloat the
// shared change-data doc.
function titleFromFileName(fileName) {
    const base = String(fileName || '').split(/[\\/]/).pop() || 'audio';
    const stem = base.replace(/\.[^.]+$/, '');
    const title = (stem || base).trim().slice(0, 100);
    return title || 'audio';
}

router.post('/api/campaigns/:campaign/audio', (req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Access denied: GM-only feature' });
    }
    const { campaign } = req.params;
    if (!fs.existsSync(campaignDir(campaign))) {
        return res.status(404).json({ error: 'campaign not found' });
    }
    const decoded = decodeAudioDataUrl(req.body?.audio);
    if (!decoded) return res.status(400).json({ error: 'audio must be a base64 data URL (data:audio/...;base64,...)' });
    const extMatch = String(req.body?.fileName || '').match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0].toLowerCase() : '';
    if (!ext) {
        return res.status(400).json({ error: `audio upload needs a filename with an extension — ${AUDIO_EXTENSIONS_HELP}` });
    }
    if (!ALLOWED_EXT.has(ext)) {
        return res.status(400).json({ error: `"${String(req.body.fileName).split(/[\\/]/).pop()}" is not a supported audio file — ${AUDIO_EXTENSIONS_HELP}` });
    }
    if (!ALLOWED_EXT.get(ext).includes(decoded.subtype)) {
        return res.status(400).json({
            error: `the file "${String(req.body.fileName).split(/[\\/]/).pop()}" reads as audio/${decoded.subtype}, which does not match its ${ext} extension — ${AUDIO_EXTENSIONS_HELP}`,
        });
    }
    try {
        const audioDir = campaignAudioDir(campaign);
        if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
        const file = newAudioFileName(ext);
        fs.writeFileSync(path.join(audioDir, file), decoded.base64, 'base64');
        res.json({ src: path.posix.join('audio', file), title: titleFromFileName(req.body.fileName) });
    } catch (e) {
        console.error('[campaign-audio]', e);
        res.status(500).json({ error: 'audio upload failed' });
    }
});

router.delete('/api/campaigns/:campaign/audio/:file', (req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Access denied: GM-only feature' });
    }
    const { campaign, file } = req.params;
    if (!fs.existsSync(campaignDir(campaign))) {
        return res.status(404).json({ error: 'campaign not found' });
    }
    const filePath = path.resolve(campaignAudioDir(campaign), file);
    // Only the upload lane's own generated names inside audio/ are deletable
    // — no traversal, no arbitrary file unlink.
    if (path.dirname(filePath) !== path.resolve(campaignAudioDir(campaign)) || !AUDIO_FILE_PATTERN.test(file)) {
        return res.status(400).json({ error: `"${file}" is not a campaign audio upload name` });
    }
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Audio file not found: ${file}` });
    }
    fs.unlinkSync(filePath);
    res.json({ deleted: true });
});

export default router;

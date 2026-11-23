/**
 * Deferred plan D — per-token custom art upload (GM-only).
 *
 * POST /api/campaigns/:campaign/token-image { image: <base64 data URL>, imageName }
 *   → { imagePath: 'images/token-…<ext>' }
 *
 * Reuses the character/NPC portrait doctrine (server/utils/imageUtils.js):
 * the base64 lives ONLY in this POST body; disk gets the decoded bytes under
 * the campaign's existing images/ directory and the map row stores just the
 * campaign-relative PATH (the 1s map autosave must never ferry inline bytes
 * toward the 5 MB body cap). Static serving (server.js express.static on
 * public/) delivers it back — no GET lane needed.
 *
 * GM-only like every other image-authoring lane (npcs.js refuseUnlessGm):
 * non-localhost origins get the same 403 copy.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { campaignDir, campaignImagesDir } from '../utils/campaignPaths.js';

const router = express.Router();

const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1';

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

// data-URL gate first: this route exists solely for FileReader payloads.
function decodeImageDataUrl(image) {
    const m = typeof image === 'string' && image.match(/^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i);
    return m ? m[1] : null;
}

router.post('/api/campaigns/:campaign/token-image', (req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Access denied: GM-only feature' });
    }
    const { campaign } = req.params;
    if (!fs.existsSync(campaignDir(campaign))) {
        return res.status(404).json({ error: 'campaign not found' });
    }
    const b64 = decodeImageDataUrl(req.body?.image);
    if (!b64) return res.status(400).json({ error: 'image must be a base64 data URL' });
    const extMatch = String(req.body?.imageName || '').match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0].toLowerCase() : '.png';
    if (!ALLOWED_EXT.has(ext)) {
        return res.status(400).json({ error: `unsupported image type ${ext} (png/jpg/jpeg/webp/gif only)` });
    }
    try {
        const imagesDir = campaignImagesDir(campaign);
        if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
        const file = `token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        fs.writeFileSync(path.join(imagesDir, file), b64, 'base64');
        res.json({ imagePath: path.join('images', file) });
    } catch (e) {
        console.error('[token-image]', e);
        res.status(500).json({ error: 'token image upload failed' });
    }
});

export default router;

/**
 * AI bearer-key management (GM admin page ↔ server-local key store).
 *
 * POST /api/ai/key { apiKey }           — store the key (or null to clear)
 * GET  /api/ai/key                     — masked status ONLY ({set, source, hint});
 *                                        the full key NEVER travels back to a browser
 *
 * LOCALHOST ONLY — the key is machine infrastructure, not campaign data. It
 * deliberately bypasses change-data: keys never mirror to player clients
 * over SSE (§12, D3). The AI endpoints attach it to localhost endpoint calls.
 */
import express from 'express';
import { saveApiKey, apiKeyStatus } from '../services/ai/providers/localProvider.js';

const router = express.Router();

const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.hostname === '::1';

router.get('/api/ai/key', (req, res) => {
    if (!isLocalhost(req)) return res.status(403).json({ error: 'localhost only' });
    res.json(apiKeyStatus());
});

router.post('/api/ai/key', (req, res) => {
    if (!isLocalhost(req)) return res.status(403).json({ error: 'localhost only' });
    const { apiKey } = req.body || {};
    if (apiKey !== null && typeof apiKey !== 'string') {
        return res.status(400).json({ error: 'apiKey must be a string or null' });
    }
    const result = saveApiKey(apiKey);
    if (!result.ok) return res.status(500).json({ error: result.reason || 'key save failed' });
    res.json({ ok: true, ...apiKeyStatus() });
});

export default router;

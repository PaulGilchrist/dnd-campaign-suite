/**
 * AI model discovery (GM admin page ↔ local model endpoint).
 *
 * POST /api/ai/models { endpoint, provider? }  — query the endpoint's model
 *                                                 list, fresh (not the stored
 *                                                 aiConfig), so the Model
 *                                                 dropdown fills while typing
 *
 * LOCALHOST ONLY — the AI config console is a GM-machine surface. The probe
 * is bounded (5s) and reuses the provider registry's models paths + the
 * server-local bearer key; a non-local endpoint is refused (D3 privacy
 * contract), so this route can never be pointed at the internet.
 */
import express from 'express';
import { probe, isLocalEndpoint } from '../services/ai/providers/localProvider.js';

const router = express.Router();

const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.hostname === '::1';

router.post('/api/ai/models', async (req, res) => {
    if (!isLocalhost(req)) return res.status(403).json({ error: 'localhost only' });
    const { endpoint, provider } = req.body || {};
    if (!isLocalEndpoint(endpoint)) {
        return res.status(400).json({ error: 'endpoint must be a local http(s) URL' });
    }
    try {
        const result = await probe({ endpoint, provider });
        if (!result.reachable) return res.status(502).json({ error: result.reason || 'endpoint unreachable' });
        res.json({ models: result.models, dialect: result.dialect });
    } catch (e) {
        console.error('[ai:models]', e);
        res.status(500).json({ error: 'model discovery failed' });
    }
});

export default router;

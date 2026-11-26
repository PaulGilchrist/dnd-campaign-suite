import express from 'express';
import path from 'path';
import guid from 'guid';
import { subscribers, characterChangeData, spellOverlayData } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';
import { isLocalhost } from '../utils/gmGuard.js';

const router = express.Router();

const SSE_PING_INTERVAL_MS = 15000;

router.get('/subscribe', (req, res) => {
    const campaignName = req.query.campaign || '';
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.writeHead(200);
    const clientId = guid.create().value;
    const newClient = {
        id: clientId,
        res,
        campaignName,
    };
    subscribers.push(newClient);
    console.log('[SSE] Client connected:', clientId, 'campaign:', campaignName, 'total:', subscribers.length);

    // Every connection learns its own hub-issued id through a NAMED event
    // (legacy clients without a 'client-id' listener ignore it — their
    // onmessage only ever sees default 'message' events). The GM-only
    // /api/sse-clients heads-up lane below accepts it as `exclude` so a tab
    // asking "who else is connected" never counts itself (playtest confirm,
    // 2026-11-25). Written FIRST, before the snapshots, so the id lands as
    // early as possible.
    try {
        res.write(`event: client-id\ndata: ${JSON.stringify({ clientId })}\n\n`);
    } catch (_e) { /* ignore */ }

    if (campaignName && characterChangeData.has(campaignName)) {
        const snapshot = characterChangeData.get(campaignName);
        for (const [key, value] of Object.entries(snapshot)) {
            const unwrapped = value && typeof value === 'object' && 'value' in value && Object.keys(value).length === 1 ? value.value : value;
            const eventData = `data: ${JSON.stringify({ key: `change-${campaignName}-${key}`, data: unwrapped })}\n\n`;
            try { res.write(eventData); } catch (_e) { break; }
        }
    }

    if (campaignName && spellOverlayData.has(campaignName)) {
        const overlays = spellOverlayData.get(campaignName);
        if (overlays.length > 0) {
            const eventData = `data: ${JSON.stringify({ key: `spell-overlay-${campaignName}`, data: { action: 'add', overlays } })}\n\n`;
            try { res.write(eventData); } catch (_e) { /* ignore */ }
        }
    }

    const pingInterval = setInterval(() => {
        try {
            res.write(':\n\n');
        } catch (_e) {
            clearInterval(pingInterval);
        }
    }, SSE_PING_INTERVAL_MS);

    req.on('close', () => {
        clearInterval(pingInterval);
        const hasError = req.destroyed || res.destroyed;
        console.log('[SSE] Client closed:', clientId, 'campaign:', campaignName, 'destroyed:', hasError, 'headersSent:', res.headersSent);
        const index = subscribers.findIndex(client => client.id === clientId);
        if (index !== -1) subscribers.splice(index, 1);
    });
});

// GM-only connected-clients heads-up lane (playtest confirm, 2026-11-25):
// how many live SSE connections a campaign currently has, straight from the
// /subscribe hub above — the app's single source of truth for who is
// connected. `exclude` names the requesting tab's own hub-issued client-id
// (delivered on its /subscribe stream) so the answer is honest "other
// clients" without the client guessing. Read-only and informational: nothing
// here gates any client. Lives OUTSIDE the /api/campaigns/:key wildcard
// family, so this late-mounted router answers it without re-ordering mounts.
router.get('/api/sse-clients', (req, res) => {
    if (!isLocalhost(req)) {
        res.status(403).json({ error: 'Access denied: GM-only feature' });
        return;
    }
    res.setHeader('Cache-Control', 'no-store');
    const campaignName = req.query.campaign || '';
    const exclude = req.query.exclude || '';
    const count = subscribers.filter(
        client => client.campaignName === campaignName && client.id !== exclude
    ).length;
    res.json({ count });
});

router.get('/health', (req, res) => {
    res.status(200).json({ status: 'Healthy' });
});

router.get(/^(?!\/(api|spell-overlay)).*/, asyncHandler((req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
}));

export default router;

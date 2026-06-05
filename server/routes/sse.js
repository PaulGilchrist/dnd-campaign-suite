import express from 'express';
import path from 'path';
import guid from 'guid';
import { subscribers, characterChangeData } from '../utils/changeData.js';

const router = express.Router();

router.get('/subscribe', (req, res) => {
    const campaignName = req.query.campaign || '';
    const clientProvidedId = req.query.clientId;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.writeHead(200);
    const clientId = guid.create().value;
    const newClient = {
        id: clientId,
        clientProvidedId,
        res,
        campaignName,
     };
    subscribers.push(newClient);

    if (campaignName && characterChangeData.has(campaignName)) {
        const snapshot = characterChangeData.get(campaignName);
        for (const [key, value] of Object.entries(snapshot)) {
            const unwrapped = value && typeof value === 'object' && 'value' in value && Object.keys(value).length === 1 ? value.value : value;
            const eventData = `data: ${JSON.stringify({ key: `change-${campaignName}-${key}`, data: unwrapped })}\n\n`;
            try { res.write(eventData); } catch (e) { break; }
         }
     }

    req.on('close', () => {
        const index = subscribers.findIndex(client => client.id === clientId);
        if (index !== -1) subscribers.splice(index, 1);
     });
});

router.get('/health', (req, res) => {
    res.status(200).json({ status: 'Healthy' });
});

router.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
});

export default router;

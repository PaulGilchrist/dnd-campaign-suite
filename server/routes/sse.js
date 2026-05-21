import express from 'express';
import path from 'path';
import os from 'os';
import guid from 'guid';
import { subscribers } from '../utils/changeData.js';

const router = express.Router();

// SSE endpoint — must be BEFORE the catch-all fallback route
router.get('/subscribe', (req, res) => {
    const headers = {
          'Content-Type': 'text/event-stream',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache'
      };
    res.writeHead(200, headers);
    const clientId = guid.create().value;
    const newClient = {
        id: clientId,
        res
     };
    subscribers.push(newClient);
    req.on('close', () => {
        console.log(`${clientId} Connection closed`);
        const index = subscribers.findIndex(client => client.id === clientId);
        if (index !== -1) subscribers.splice(index, 1);
     });
    console.log(`Current subscriber count = ${subscribers.length}`)
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'Healthy' });
});

// React Router fallback — MUST be last
router.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
});

export default router;

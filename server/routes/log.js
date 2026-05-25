import express from 'express';
import fs from 'fs';
import path from 'path';
import guid from 'guid';
import { publish } from '../utils/changeData.js';

const router = express.Router();

// In-memory cache for logs per campaign
const logCache = new Map();

function getCampaignDir(campaign) {
  return path.join(process.cwd(), 'public', 'campaigns', campaign);
}

function loadLog(campaign) {
  if (logCache.has(campaign)) return logCache.get(campaign);
  const file = path.join(getCampaignDir(campaign), 'data', 'campaign-log.json');
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      logCache.set(campaign, Array.isArray(data) ? data : []);
      return logCache.get(campaign);
     }
   } catch (err) {
    console.error(`Failed to read log for campaign ${campaign}:`, err.message);
   }
  logCache.set(campaign, []);
  return [];
}

function saveLogFile() {
  if (saveLogFile._timer) clearTimeout(saveLogFile._timer);
  saveLogFile._timer = setTimeout(() => {
    for (const campaign of logCache.keys()) {
      const fileDir = path.join(getCampaignDir(campaign), 'data');
      if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });
      const file = path.join(fileDir, 'campaign-log.json');
      try {
        const log = logCache.get(campaign);
        const trimmed = log.slice(-500);
        fs.writeFileSync(file, JSON.stringify(trimmed));
       } catch (err) {
        console.error(`Failed to save log for campaign ${campaign}:`, err.message);
       }
     }
    saveLogFile._timer = null;
   }, 1000);
}

function addEntry(campaign, entry) {
  const log = loadLog(campaign);
  const newEntry = {
    id: guid.create().toString(),
    timestamp: Date.now(),
     ...entry
   };
  log.push(newEntry);
  logCache.set(campaign, log);
  saveLogFile();

  publish(`log-${campaign}`, newEntry);
  return newEntry;
}

// GET /api/campaigns/:campaign/log - returns full log (last 500 entries)
router.get('/api/campaigns/:campaign/log', (req, res) => {
  const log = loadLog(req.params.campaign);
  res.json(log.slice(-500));
});

// POST /api/campaigns/:campaign/log - add a new log entry
router.post('/api/campaigns/:campaign/log', (req, res) => {
  const entry = addEntry(req.params.campaign, req.body);
  res.json(entry);
});

export default router;

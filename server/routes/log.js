import express from 'express';
import fs from 'fs';
import guid from 'guid';
import { publish } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignDataFile, campaignDir, ensureDataDir } from '../utils/campaignPaths.js';

const router = express.Router();

// In-memory cache for logs per campaign
const logCache = new Map();

export { logCache };

function loadLog(campaign) {
  if (logCache.has(campaign)) return logCache.get(campaign);
  const file = campaignDataFile(campaign, 'campaign-log.json');
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
      if (!fs.existsSync(campaignDir(campaign))) {
        console.error(`[log] Skipping persist for campaign "${campaign}" — its directory no longer exists on disk. Removing from memory to prevent phantom campaign regeneration.`);
        logCache.delete(campaign);
        continue;
      }
      ensureDataDir(campaign);
      const file = campaignDataFile(campaign, 'campaign-log.json');
      try {
        const log = logCache.get(campaign);
        const trimmed = log.slice(-500);
        fs.writeFileSync(file, JSON.stringify(trimmed, null, 2));
      } catch (err) {
        console.error(`Failed to save log for campaign ${campaign}:`, err.message);
      }
    }
    saveLogFile._timer = null;
  }, 1000);
}

// Exported for L5 server-dice (campaigns-roll.js) — one log pipeline.
export function addEntry(campaign, entry) {
  const log = loadLog(campaign);
  const newEntry = {
    id: guid.create().toString(),
    timestamp: Date.now(),
    ...entry
  };
  log.push(newEntry);
  logCache.set(campaign, log);
  saveLogFile();

  publish(`log-${campaign}`, newEntry, campaign);  return newEntry;
}

// GET /api/campaigns/:campaign/log - returns full log (last 500 entries)
router.get('/api/campaigns/:campaign/log', asyncHandler((req, res) => {
  const log = loadLog(req.params.campaign);
  res.json(log.slice(-500));
}));

// POST /api/campaigns/:campaign/log - add a new log entry
router.post('/api/campaigns/:campaign/log', asyncHandler((req, res) => {
  const entry = addEntry(req.params.campaign, req.body);
  res.json(entry);
}));

export default router;

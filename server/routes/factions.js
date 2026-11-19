import { Router } from 'express';
import { createJsonEntityRouter, loadEntityList } from '../utils/jsonEntityCrud.js';
import { findDuplicateNameError } from '../utils/nameUniqueness.js';
import { publish } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';

const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1';

// Mirrors broadcastNPCsList (routes/npcs.js): every list mutation publishes a
// `factions-list-<campaign>` SSE event so other GM tabs re-fetch live.
const broadcastFactionsList = (action, campaign, payload = {}) => {
  publish(`factions-list-${campaign}`, { action, ...payload }, campaign);
};

const baseRouter = createJsonEntityRouter('factions', {
  pluralDisplayName: 'Factions',
  singularDisplayName: 'Faction',
  // 409 conflict copy labels rows by the same field the list renders as the
  // row title (Factions.jsx row name); blank names fall back to the id.
  displayField: 'name',
  broadcast: broadcastFactionsList,
  validateList: (factions) => findDuplicateNameError(factions, 'faction'),
});

// ---------------------------------------------------------------------------
// GM-only lane — the Factions planner is a GM-authoring surface (sidebar
// marks it localhostOnly; the only client consumers of /factions are
// Factions.jsx (that GM-only view) and draftActions.js (CampaignBuilder
// Drafts, also localhostOnly); the only visitor-facing door is the narrow
// /factions/standings read above).
// The whole lane (reads AND writes) refuses non-localhost origins, mirroring
// the sessions.js / quests.js refuseUnlessGm wrapper shape (same 403 copy +
// dev-log). The factory offers no per-lane write hook, so the gate wraps the
// mounted router with a path-scoped use() BEFORE baseRouter (per-route use()
// after creation lands too late). bug-npcs-factions-settlements-lanes-no-
// origin-guard.
// ---------------------------------------------------------------------------
function refuseUnlessGm(req, res) {
  if (isLocalhost(req)) return true;
  console.log(`[factions] BLOCKED non-localhost ${req.method} ${req.originalUrl} — GM-only`);
  res.status(403).json({ error: 'Access denied: GM-only feature' });
  return false;
}

// ---------------------------------------------------------------------------
// Player-facing standings read lane (Item 9 — player quest board): the ONLY
// visitor-open door on this path is this GET. The GM CRUD gate below stays
// byte-unchanged (every other method on every /factions path still 403s for
// non-localhost). The response is a field WHITELIST — only the compact
// standing (name + 1–10 influence) crosses the wire; `description`, `goals`
// and `notes` are GM planning text and never leave the server, and
// unapproved AI draft rows are dropped for every origin. Updates reach
// players via the existing `factions-list-<campaign>` SSE broadcast.
// ---------------------------------------------------------------------------
const STANDINGS_FIELDS = ['id', 'name', 'influence'];

function toStandingRow(faction) {
  return STANDINGS_FIELDS.reduce((picked, field) => {
    if (faction[field] !== undefined) picked[field] = faction[field];
    return picked;
  }, {});
}

const router = Router();
router.get('/api/campaigns/:campaign/factions/standings', asyncHandler((req, res) => {
  const factions = loadEntityList(req.params.campaign, 'factions')
    .filter(faction => faction && faction.draft !== true)
    .map(toStandingRow);
  res.json({ factions });
}));
router.use('/api/campaigns/:campaign/factions', (req, res, next) => {
  if (!refuseUnlessGm(req, res)) return;
  next();
});
router.use(baseRouter);

export default router;

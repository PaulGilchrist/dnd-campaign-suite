import { Router } from 'express';
import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';
import { findDuplicateNameError } from '../utils/nameUniqueness.js';
import { publish } from '../utils/changeData.js';

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
// Drafts, also localhostOnly) — there is no visitor read/write consumer).
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

const router = Router();
router.use('/api/campaigns/:campaign/factions', (req, res, next) => {
  if (!refuseUnlessGm(req, res)) return;
  next();
});
router.use(baseRouter);

export default router;

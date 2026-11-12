import { Router } from 'express';
import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';
import { findDuplicateNameError } from '../utils/nameUniqueness.js';
import { publish } from '../utils/changeData.js';

const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1';

// Mirrors broadcastNPCsList (routes/npcs.js): every list mutation publishes a
// `quests-list-<campaign>` SSE event so other GM tabs re-fetch live.
const broadcastQuestsList = (action, campaign, payload = {}) => {
  publish(`quests-list-${campaign}`, { action, ...payload }, campaign);
};

const baseRouter = createJsonEntityRouter('quests', {
  pluralDisplayName: 'quests',
  // Display noun for 404/409 copy (matches the NPC/Faction/Settlement lanes);
  // duplicate-name 400 copy stays lowercase 'A quest with that name already exists'.
  singularDisplayName: 'Quest',
  // 409 conflict copy labels rows by the same field the list renders as the
  // row title (Quests.jsx row name); blank names fall back to the id.
  displayField: 'name',
  broadcast: broadcastQuestsList,
  validateList: (quests) => findDuplicateNameError(quests, 'quest'),
  // The lane gate below replaces the former row-level read options
  // (transformList [] for non-localhost + authorizeRead 403): every
  // non-localhost method now 403s before the factory lanes run, so the
  // read-filter branches became unreachable.
});

// ---------------------------------------------------------------------------
// GM-only lane — the Quests planner is a GM-authoring surface (sidebar marks
// it localhostOnly; there is no visitor read/write consumer). The reads were
// already fully GM-gated at the row level (transformList [] + authorizeRead
// 403), but the factory write lanes (whole-array POST, per-row DELETE) had NO
// origin gate: a visitor POST could never include the rows its own read was
// shown, so the concurrent-save guard 409'd naming a HIDDEN GM quest title
// (one-probe-at-a-time label leak, unrecoverable via reload), and a visitor
// DELETE by id landed outright. The whole lane (reads AND writes) now refuses
// non-localhost origins, mirroring the sessions.js refuseUnlessGm wrapper
// shape (same 403 copy + dev-log). The factory offers no per-lane write hook,
// so the gate wraps the mounted router with a path-scoped use() BEFORE
// baseRouter (per-route use() after creation lands too late).
// bug-quests-write-lane-no-gm-guard-leaks-hidden-quest-labels.
// ---------------------------------------------------------------------------
function refuseUnlessGm(req, res) {
  if (isLocalhost(req)) return true;
  console.log(`[quests] BLOCKED non-localhost ${req.method} ${req.originalUrl} — GM-only`);
  res.status(403).json({ error: 'Access denied: GM-only feature' });
  return false;
}

const router = Router();
router.use('/api/campaigns/:campaign/quests', (req, res, next) => {
  if (!refuseUnlessGm(req, res)) return;
  next();
});
router.use(baseRouter);

export default router;

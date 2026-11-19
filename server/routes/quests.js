import { Router } from 'express';
import { createJsonEntityRouter, loadEntityList } from '../utils/jsonEntityCrud.js';
import { findDuplicateNameError } from '../utils/nameUniqueness.js';
import { publish } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';

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
// it localhostOnly; the only visitor-facing door on this path is the narrow
// /quests/board read above). The reads were
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

// ---------------------------------------------------------------------------
// Player-facing board read lane (Item 9 — player quest board): the ONLY
// visitor-open door on this path is this GET. The GM CRUD gate below stays
// byte-unchanged (every other method on every /quests path still 403s for
// non-localhost). The response is a field WHITELIST — GM `notes` never leave
// the server, and unapproved AI draft rows are dropped for every origin
// (the board is approved-content theatre; drafts surface only in the GM
// planner/Drafts views, which badge them). Data changes reach players
// through the existing `quests-list-<campaign>` SSE broadcast (publish()
// fans out to all campaign subscribers regardless of origin).
// ---------------------------------------------------------------------------
const BOARD_FIELDS = ['id', 'name', 'status', 'description', 'rewards'];

function toBoardRow(row) {
  return BOARD_FIELDS.reduce((picked, field) => {
    if (row[field] !== undefined) picked[field] = row[field];
    return picked;
  }, {});
}

const router = Router();
router.get('/api/campaigns/:campaign/quests/board', asyncHandler((req, res) => {
  const quests = loadEntityList(req.params.campaign, 'quests')
    .filter(row => row && row.draft !== true)
    .map(toBoardRow);
  res.json({ quests });
}));
router.use('/api/campaigns/:campaign/quests', (req, res, next) => {
  if (!refuseUnlessGm(req, res)) return;
  next();
});
router.use(baseRouter);

export default router;

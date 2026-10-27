import { Router } from 'express';
import fs from 'fs';
import { campaignDataFile, ensureDataDir } from './campaignPaths.js';
import asyncHandler from './asyncHandler.js';

function singularize(name) {
  if (name === 'npcs') return 'npc';
  if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
  if (name.endsWith('s')) return name.slice(0, -1);
  return name;
}

// ---------------------------------------------------------------------------
// Concurrent-save guard (bug-ct-editor-concurrent-save): every row written by
// this lane carries an `updatedAt` stamp (epoch ms). GET returns the stamp,
// the `.ct-*` editors keep it in their form state and echo it back on save.
// A save whose stamp differs from the disk stamp provably never read the
// current row — refuse with 409 instead of silently clobbering edits that
// another tab/session already persisted. A whole-array POST that omits a
// disk row likewise dropped an entity created elsewhere — also 409. Legacy
// rows without any stamp stay writable (bootstrap), and get stamped on write.
// ---------------------------------------------------------------------------

const STALE_EDIT_ERROR = 'reload the list and re-apply your edit — it was NOT saved.';

function canonicalize(value, stripStamp = false) {
  if (Array.isArray(value)) return value.map(item => canonicalize(item));
  if (value && typeof value === 'object') {
    const keys = Object.keys(value)
      .filter(key => !(stripStamp && key === 'updatedAt'))
      .sort();
    return keys.reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
  }
  return value;
}

/** True when two entity snapshots hold identical content (ignoring the stamp). */
export function sameEntityContent(a, b) {
  return JSON.stringify(canonicalize(a, true)) === JSON.stringify(canonicalize(b, true));
}

/** True when the sender's echoed stamp proves it never read the current row. */
export function hasUpdateConflict(existing, incoming) {
  return Boolean(
    existing && existing.updatedAt && incoming && incoming.updatedAt
    && existing.updatedAt !== incoming.updatedAt
  );
}

/** Stamp a row for writing: unchanged content on an already-stamped row
 *  keeps its stamp (so tabs editing OTHER rows never false-conflict); every
 *  other write (new/changed/legacy-unstamped rows) gets a fresh stamp, forced
 *  strictly greater than the previous one so same-millisecond saves can never
 *  produce an ambiguous (equal) stamp. */
export function stampForSave(incoming, existing, now = Date.now()) {
  if (existing && typeof existing.updatedAt === 'number' && sameEntityContent(incoming, existing)) {
    return { ...incoming, updatedAt: existing.updatedAt };
  }
  const next = typeof existing?.updatedAt === 'number' ? Math.max(now, existing.updatedAt + 1) : now;
  return { ...incoming, updatedAt: next };
}

export function conflictErrorBody(singularDisplayName, id, reason = 'modified') {
  const label = id ? `${singularDisplayName} "${id}"` : singularDisplayName;
  return {
    error: `${label} was ${reason} in another tab or session since you loaded it — ${STALE_EDIT_ERROR}`,
    conflict: true,
  };
}

// Detects a blind overwrite in a whole-array write: a row the sender re-sent
// with a stale stamp, or a disk row the sender's snapshot never knew about.
// Returns { id, reason } for the first offender, or null when the write is safe.
function findConcurrentWrite(diskEntities, incomingEntities, idField) {
  const diskById = new Map(
    diskEntities.filter(d => d && d[idField] != null).map(d => [d[idField], d])
  );
  const incomingIds = new Set();
  for (const incoming of incomingEntities) {
    const id = incoming?.[idField];
    if (id != null) incomingIds.add(id);
    const existing = id != null ? diskById.get(id) : undefined;
    if (existing && hasUpdateConflict(existing, incoming)) {
      return { id, reason: 'modified' };
    }
  }
  for (const id of diskById.keys()) {
    if (!incomingIds.has(id)) {
      return { id, reason: 'created or deleted' };
    }
  }
  return null;
}

export function createJsonEntityRouter(entityName, options = {}) {
  const {
    idField = 'id',
    responseWrapper = entityName,
    itemWrapper = singularize(entityName),
    pluralDisplayName = entityName,
    singularDisplayName = singularize(entityName),
    transformList = null,
    authorizeRead = null,
    forbiddenMessage = 'Access denied',
    onDelete = null,
    validateList = null,
    broadcast = null,
    extraRoutes = () => {},
  } = options;

  const router = Router();
  const getFilePath = (campaign) => campaignDataFile(campaign, `${entityName}.json`);

  const loadOrInit = (campaign) => {
    const filePath = getFilePath(campaign);
    if (!fs.existsSync(filePath)) {
      ensureDataDir(campaign);
      fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      return [];
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  };

  // GET /api/campaigns/:campaign/[entityName] — list all
  router.get(`/api/campaigns/:campaign/${entityName}`, asyncHandler((req, res) => {
    try {
      const { campaign } = req.params;
      const entities = loadOrInit(campaign);
      const result = transformList ? transformList(entities, req) : entities;
      res.json({ [responseWrapper]: result });
    } catch (error) {
      console.error(`Error reading ${entityName}:`, error);
      throw new Error(`Failed to read ${pluralDisplayName}`);
    }
  }));

  // POST /api/campaigns/:campaign/[entityName] — overwrite entire array
  // (guarded: refuses to clobber/drop rows the sender never read — see the
  // concurrent-save guard above).
  router.post(`/api/campaigns/:campaign/${entityName}`, asyncHandler((req, res) => {
    try {
      const { campaign } = req.params;
      const entities = req.body[entityName];
      if (!Array.isArray(entities)) {
        return res.status(400).json({ error: `Expected an array for ${entityName}` });
      }
      if (validateList) {
        const validationError = validateList(entities);
        if (validationError) {
          return res.status(400).json({ error: validationError });
        }
      }
      const diskEntities = loadOrInit(campaign);
      const clash = findConcurrentWrite(diskEntities, entities, idField);
      if (clash) {
        return res.status(409).json(conflictErrorBody(singularDisplayName, clash.id, clash.reason));
      }
      const now = Date.now();
      const stamped = entities.map(incoming => stampForSave(
        incoming,
        incoming?.[idField] != null
          ? diskEntities.find(d => d && d[idField] === incoming[idField])
          : undefined,
        now
      ));
      const filePath = getFilePath(campaign);
      ensureDataDir(campaign);
      fs.writeFileSync(filePath, JSON.stringify(stamped, null, 2));
      if (broadcast) broadcast('replaced', campaign, {});
      res.json({ success: true });
    } catch (error) {
      console.error(`Error saving ${entityName}:`, error);
      throw new Error(`Failed to save ${pluralDisplayName}`);
    }
  }));

  // GET /api/campaigns/:campaign/[entityName]/:id — get one by idField
  router.get(`/api/campaigns/:campaign/${entityName}/:id`, asyncHandler((req, res) => {
    try {
      const { campaign, id } = req.params;
      const decodedId = decodeURIComponent(id);
      const filePath = getFilePath(campaign);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `${singularDisplayName} not found` });
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const entities = Array.isArray(data) ? data : [];
      const entity = entities.find(e => e[idField] === decodedId);

      if (!entity) {
        return res.status(404).json({ error: `${singularDisplayName} not found` });
      }

      if (authorizeRead && !authorizeRead(entity, req)) {
        return res.status(403).json({ error: forbiddenMessage });
      }

      res.json({ [itemWrapper]: entity });
    } catch (error) {
      console.error(`Error reading ${entityName}:`, error);
      throw new Error(`Failed to read ${singularDisplayName}`);
    }
  }));

  // DELETE /api/campaigns/:campaign/[entityName]/:id — delete one by idField
  router.delete(`/api/campaigns/:campaign/${entityName}/:id`, asyncHandler((req, res) => {
    try {
      const { campaign, id } = req.params;
      const decodedId = decodeURIComponent(id);
      const filePath = getFilePath(campaign);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `${singularDisplayName} not found` });
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const entities = Array.isArray(data) ? data : [];
      const entity = entities.find(e => e[idField] === decodedId);
      if (onDelete && entity) {
        onDelete(entity, campaign);
      }
      const filtered = entities.filter(e => e[idField] !== decodedId);

      fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2));
      if (broadcast) broadcast('deleted', campaign, { name: decodedId });

      res.json({ success: true });
    } catch (error) {
      console.error(`Error deleting ${entityName}:`, error);
      throw new Error(`Failed to delete ${pluralDisplayName}`);
    }
  }));

  extraRoutes(router, entityName);

  return router;
}

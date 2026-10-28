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
// disk row likewise dropped an entity created elsewhere — also 409 — and the
// symmetric leg holds too: a re-sent row (with an echoed stamp) that disk no
// longer has would resurrect an entity deleted elsewhere — also 409. Legacy
// rows without any stamp stay writable (bootstrap), and get stamped on write.
// The per-entity PUT-upsert lanes (npcs, sessions, settlements) share the
// same 'modified' (hasUpdateConflict) and 'created or deleted'
// (isResurrectionAttempt) discriminators so the two write paths can never
// drift apart again. Exception on the array lane only: a stamped row whose
// echo matches a live row's CURRENT stamp and whose content equals it apart
// from the id is a verbatim CLONE (copy/rename), accepted and re-stamped —
// see isVerbatimClone.
// ---------------------------------------------------------------------------

const STALE_EDIT_ERROR = 'reload the list and re-apply your edit — it was NOT saved.';

function canonicalize(value, stripKeys = []) {
  if (Array.isArray(value)) return value.map(item => canonicalize(item));
  if (value && typeof value === 'object') {
    const keys = Object.keys(value)
      .filter(key => !stripKeys.includes(key))
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
  return JSON.stringify(canonicalize(a, ['updatedAt'])) === JSON.stringify(canonicalize(b, ['updatedAt']));
}

/** True when a save echoes an `updatedAt` stamp for a row disk no longer has —
 *  the sender could only have read it BEFORE another tab/session deleted the
 *  row, so accepting the save would silently resurrect it. Shared by the
 *  whole-array POST (findConcurrentWrite) and the per-entity PUT-upsert lanes
 *  (npcs/sessions/settlements) so the two can never drift apart again. A
 *  brand-new row carries no echoed stamp (the client never sets updatedAt), so
 *  genuine creates never trip it; legacy un-stamped rows stay bootstrap-writable.
 *  The array lane layers ONE exception on top: a stamped row disk doesn't know
 *  may still be a verbatim clone of a LIVE row (see isVerbatimClone) — the PUT
 *  lanes keep this discriminator strict (their pinned create contract). */
export function isResurrectionAttempt(existing, incoming, id) {
  return id != null && !existing && Boolean(incoming) && typeof incoming.updatedAt === 'number';
}

/** True when a stamped row the sender POSTs under an id disk does not know is
 *  a verbatim COPY of a live disk row — the clone/copy scenario (a test rig or
 *  future clone feature copies an existing row, renames it, and carries the
 *  source's CURRENT stamp along). Two facts make it provably safe: the echoed
 *  stamp equals a live row's current stamp (the sender read that source fresh —
 *  it cannot clobber a row it never missed), and the content is byte-identical
 *  to the source ignoring the stamp and the id (no hidden edit rides along).
 *  A genuine ghost keeps its resurrection verdict: an echoed stamp no live row
 *  carries (the source row was deleted elsewhere) or a copy whose content
 *  differs beyond the id is a same-stamp overwrite attempt and must 409.
 *  Accepted clones fall through to stampForSave, which gives them a fresh
 *  stamp on write (no-op normalization — the copy never ships the source's). */
export function isVerbatimClone(diskEntities, incoming, idField) {
  if (!incoming || typeof incoming.updatedAt !== 'number') return false;
  const stripKeys = ['updatedAt', idField];
  const target = JSON.stringify(canonicalize(incoming, stripKeys));
  const incomingId = incoming[idField];
  return (diskEntities || []).some(disk => disk
    && disk[idField] !== incomingId
    && disk.updatedAt === incoming.updatedAt
    && JSON.stringify(canonicalize(disk, stripKeys)) === target
  );
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

/** Build the 409 conflict body. `label` is whatever identifies the row to a
 *  human: per-entity PUT lanes pass the decoded display name (NPC/Session/
 *  Settlement); the whole-array POST lane passes the row's displayField title
 *  with an id fallback (Notes → partyLocation). Falls back to the bare noun
 *  when there is nothing to label with — the copy must NEVER render `""`. */
export function conflictErrorBody(singularDisplayName, label, reason = 'modified') {
  const labelled = label ? `${singularDisplayName} "${label}"` : singularDisplayName;
  return {
    error: `${labelled} was ${reason} in another tab or session since you loaded it — ${STALE_EDIT_ERROR}`,
    conflict: true,
  };
}

// Detects a blind overwrite in a whole-array write: a row the sender re-sent
// with a stale stamp, a row the sender's snapshot resurrects after it was
// deleted elsewhere, or a disk row the sender's snapshot never knew about.
// Returns { id, label, reason } for the first offender, or null when the write
// is safe. `label` mirrors what the PUT lanes pass to conflictErrorBody: the
// row's displayField title when configured and non-blank (e.g. Notes'
// partyLocation — the same field the list renders as the row title), falling
// back to the raw id so lanes without a displayField (and untitled rows) keep
// the id-labelled copy unchanged.
function findConcurrentWrite(diskEntities, incomingEntities, idField, displayField) {
  const titleOf = (row) => {
    if (!displayField || !row) return '';
    const raw = row[displayField];
    return typeof raw === 'string' ? raw.trim() : '';
  };
  const labelFor = (existing, incoming, id) =>
    titleOf(existing) || titleOf(incoming) || id;
  const diskById = new Map(
    diskEntities.filter(d => d && d[idField] != null).map(d => [d[idField], d])
  );
  const incomingIds = new Set();
  for (const incoming of incomingEntities) {
    const id = incoming?.[idField];
    if (id != null) incomingIds.add(id);
    const existing = id != null ? diskById.get(id) : undefined;
    if (existing && hasUpdateConflict(existing, incoming)) {
      return { id, label: labelFor(existing, incoming, id), reason: 'modified' };
    }
    // Resurrection leg (shared discriminator — see isResurrectionAttempt):
    // an incoming row absent from disk that echoes an updatedAt stamp proves
    // the sender read it BEFORE another tab/session deleted it — saving would
    // silently undo that delete. ONE exception (bug-npc-bulk-post-clone-409):
    // a stamped row whose echo matches a LIVE disk row's current stamp AND
    // whose content equals that row's apart from the id is a verbatim clone
    // (copy/rename), not a ghost — accept it and let stampForSave re-stamp.
    if (isResurrectionAttempt(existing, incoming, id)
      && !isVerbatimClone(diskEntities, incoming, idField)) {
      return { id, label: labelFor(existing, incoming, id), reason: 'created or deleted' };
    }
  }
  for (const id of diskById.keys()) {
    if (!incomingIds.has(id)) {
      return { id, label: labelFor(diskById.get(id), undefined, id), reason: 'created or deleted' };
    }
  }
  return null;
}

export function createJsonEntityRouter(entityName, options = {}) {
  const {
    idField = 'id',
    // Optional row field naming a human-readable title used to label 409
    // conflict copy (Notes → 'partyLocation'); rows with a blank title, and
    // lanes without this option, keep labelling by idField value.
    displayField = null,
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
      const clash = findConcurrentWrite(diskEntities, entities, idField, displayField);
      if (clash) {
        return res.status(409).json(conflictErrorBody(singularDisplayName, clash.label, clash.reason));
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

      // Missing-id deletes 404 like missing files (run-G backlog): a silent
      // 200 lied about deleting. Returning here keeps the request fully inert
      // — no file write, no onDelete side effect, no 'deleted' SSE broadcast.
      if (!entity) {
        return res.status(404).json({ error: `${singularDisplayName} not found` });
      }

      if (onDelete) {
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

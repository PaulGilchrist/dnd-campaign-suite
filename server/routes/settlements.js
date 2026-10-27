import fs from 'fs';
import { campaignDataFile, ensureDataDir } from '../utils/campaignPaths.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  createJsonEntityRouter,
  conflictErrorBody,
  hasUpdateConflict,
  stampForSave,
} from '../utils/jsonEntityCrud.js';
import { findDuplicateNameError } from '../utils/nameUniqueness.js';

// Display noun for conflict/404 copy (matches the NPC lane's 'NPC'; duplicate-
// name 400 copy stays lowercase 'A settlement with that name already exists').
const SINGULAR_DISPLAY_NAME = 'Settlement';

const baseRouter = createJsonEntityRouter('settlements', {
  idField: 'name',
  pluralDisplayName: 'settlements',
  singularDisplayName: SINGULAR_DISPLAY_NAME,
  validateList: (settlements) => findDuplicateNameError(settlements, 'settlement'),
});

// Resolve the row a PUT/URL parameter targets (run-G backlog: PUT-by-id used
// to match nothing, so the dup-name guard self-collided the 400 before the
// conflict guard could fire). Rows are keyed by name — the client contract in
// src/services/campaign/settlementsService.js — but may also carry a generator
// `id`; match name first (backward compatible), then id.
export function resolveSettlementIndex(rows, param) {
  const byName = rows.findIndex(s => s.name === param);
  if (byName !== -1) return byName;
  return rows.findIndex(s => s.id != null && s.id === param);
}

// PUT /api/campaigns/:campaign/settlements/:settlementName — upsert by id-or-name
baseRouter.put('/api/campaigns/:campaign/settlements/:settlementName', asyncHandler((req, res) => {
  try {
    const { campaign, settlementName } = req.params;
    const decodedName = decodeURIComponent(settlementName);
    const updatedSettlement = req.body;
    const filePath = campaignDataFile(campaign, 'settlements.json');

    ensureDataDir(campaign);

    let settlements = [];
    if (fs.existsSync(filePath)) {
      settlements = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    if (!Array.isArray(settlements)) settlements = [];

    const existingIndex = resolveSettlementIndex(settlements, decodedName);

    // Duplicate-name guard (mirrors npcs.js PUT guard): a rename must not
    // collide case-insensitively with ANOTHER settlement's name — the
    // resolved row itself is excluded (not just URL-name-equal rows) so the
    // id leg, whose URL never equals the row's name, never self-collides.
    const newName = (updatedSettlement.name || '').trim();
    if (!newName) {
      return res.status(400).json({ error: 'Settlement name is required' });
    }
    const nameCollision = settlements.find((s, i) =>
      i !== existingIndex && (s.name || '').toLowerCase() === newName.toLowerCase()
    );
    if (nameCollision) {
      return res.status(400).json({ error: 'A settlement with that name already exists' });
    }

    // Concurrent-save guard (mirrors jsonEntityCrud POST): stale echoed stamp
    // = this tab never read the current row — refuse instead of clobbering.
    // Only the 'modified' leg applies here: a PUT to an unknown id-or-name is
    // the route's upsert-create contract, not a stale-row signal.
    const existingSettlement = existingIndex !== -1 ? settlements[existingIndex] : null;
    if (hasUpdateConflict(existingSettlement, updatedSettlement)) {
      const displayName = existingSettlement.name || decodedName;
      return res.status(409).json(conflictErrorBody(SINGULAR_DISPLAY_NAME, displayName));
    }

    const stampedSettlement = stampForSave(updatedSettlement, existingSettlement);
    if (existingIndex !== -1) {
      settlements[existingIndex] = stampedSettlement;
    } else {
      settlements.push(stampedSettlement);
    }

    fs.writeFileSync(filePath, JSON.stringify(settlements, null, 2));
    res.json({ success: true, settlement: stampedSettlement });
  } catch (error) {
    console.error('Error updating settlement:', error);
    throw new Error('Failed to update settlement');
  }
}));

export default baseRouter;

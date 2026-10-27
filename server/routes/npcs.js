import path from 'path';
import fs from 'fs';
import { processImageUpload, deleteCharacterImage } from '../utils/imageUtils.js';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignDataFile, campaignImagesDir, ensureDataDir } from '../utils/campaignPaths.js';
import {
  createJsonEntityRouter,
  conflictErrorBody,
  hasUpdateConflict,
  isResurrectionAttempt,
  stampForSave,
} from '../utils/jsonEntityCrud.js';
import { publish } from '../utils/changeData.js';

const broadcastNPCsList = (action, campaign, payload = {}) => {
  publish(`npcs-list-${campaign}`, { action, ...payload }, campaign);
};

// Owner invariant: npcs.json is reserved for CUSTOM NPCs — pre-made monsters
// come from the Encounter Builder and pull real stats from monsters.json.
// Saving a bestiary name here creates shadow entries whose placeholder stats
// override the real stat block when the GM clicks the tracker avatar.
let bestiaryNames = null;
function isBestiaryMonsterName(name) {
  if (!bestiaryNames) {
    const monstersPath = path.join(process.cwd(), 'public', 'data', 'monsters.json');
    try {
      const raw = JSON.parse(fs.readFileSync(monstersPath, 'utf-8'));
      const list = Array.isArray(raw) ? raw : (raw.monsters || []);
      bestiaryNames = new Set(list.map(m => String(m?.name || '').toLowerCase()).filter(Boolean));
    } catch (error) {
      console.error('Error loading monsters.json for NPC name guard:', error);
      return false; // monsters.json unreadable — never block legitimate NPC saves
    }
  }
  return bestiaryNames.has(String(name || '').trim().toLowerCase());
}

function bestiaryNameError(name) {
  return `"${name}" is a published monster — monsters join through the Encounter Builder with their real stat block. NPCs are for custom characters with their own name.`;
}

const baseRouter = createJsonEntityRouter('npcs', {
  idField: 'name',
  pluralDisplayName: 'NPCs',
  singularDisplayName: 'NPC',
  broadcast: broadcastNPCsList,
  validateList: (entities) => {
    for (const npc of entities || []) {
      if (isBestiaryMonsterName(npc?.name)) return bestiaryNameError(npc.name);
    }
    return null;
  },
  onDelete: (npc) => {
    if (npc.imagePath) {
      deleteCharacterImage(npc.imagePath);
    }
  },
});

function renameImageForNewName(campaign, updatedNpc, originalImagePath) {
  const oldImageFullPath = path.join(process.cwd(), 'public', originalImagePath);
  if (!fs.existsSync(oldImageFullPath)) return;
  const ext = path.extname(oldImageFullPath);
  const newImageFileName = `${updatedNpc.name}${ext}`;
  const newImageFullPath = path.join(campaignImagesDir(campaign), newImageFileName);
  if (oldImageFullPath !== newImageFullPath) {
    fs.renameSync(oldImageFullPath, newImageFullPath);
    updatedNpc.imagePath = path.join('images', newImageFileName);
  }
}

function handleImageChange(campaign, updatedNpc, existingNpc, originalImagePath) {
  if ((!updatedNpc.imagePath || updatedNpc.imagePath === '') && originalImagePath) {
    deleteCharacterImage(originalImagePath);
    updatedNpc.imagePath = '';
  } else if (updatedNpc.image && updatedNpc.imageName) {
    processImageUpload(campaign, updatedNpc.name, updatedNpc, originalImagePath);
  } else if (existingNpc && updatedNpc.name !== existingNpc.name && originalImagePath) {
    renameImageForNewName(campaign, updatedNpc, originalImagePath);
  }
}

// PUT /api/campaigns/:campaign/npcs/:npcName — upsert by name with image handling
baseRouter.put('/api/campaigns/:campaign/npcs/:npcName', asyncHandler((req, res) => {
  try {
    const { campaign, npcName } = req.params;
    const decodedNpcName = decodeURIComponent(npcName);
    const updatedNpc = req.body;
    const npcPath = campaignDataFile(campaign, 'npcs.json');

    ensureDataDir(campaign);

    let npcs = [];
    if (fs.existsSync(npcPath)) {
      npcs = JSON.parse(fs.readFileSync(npcPath, 'utf-8'));
    }
    if (!Array.isArray(npcs)) npcs = [];

    const existingIndex = npcs.findIndex(n => n.name === decodedNpcName);
    const existingNpc = existingIndex !== -1 ? npcs[existingIndex] : null;

    // Duplicate-name guard (mirrors maps.js rename guard): a rename must not
    // collide case-insensitively with another NPC's name.
    const newName = (updatedNpc.name || '').trim();
    if (!newName) {
      return res.status(400).json({ error: 'NPC name is required' });
    }
    const nameCollision = npcs.find(n =>
      n.name !== decodedNpcName && (n.name || '').toLowerCase() === newName.toLowerCase()
    );
    if (nameCollision) {
      return res.status(400).json({ error: 'An NPC with that name already exists' });
    }

    // Owner invariant (see isBestiaryMonsterName above): no bestiary monsters in npcs.json.
    if (isBestiaryMonsterName(newName)) {
      return res.status(400).json({ error: bestiaryNameError(newName) });
    }

    // Concurrent-save guard (mirrors jsonEntityCrud POST): an echoed stale
    // updatedAt proves this tab never read the current row — refuse BEFORE
    // touching image files so a rejected save is fully inert.
    if (hasUpdateConflict(existingNpc, updatedNpc)) {
      return res.status(409).json(conflictErrorBody('NPC', decodedNpcName));
    }

    // Resurrection leg (mirrors the array lane's guard): the row is gone from
    // disk (deleted in another tab/session) yet the sender echoes the stamp it
    // read while the row still existed — refuse instead of silently reviving
    // the deleted NPC. A genuine create carries no updatedAt (see
    // isResurrectionAttempt).
    if (isResurrectionAttempt(existingNpc, updatedNpc, decodedNpcName)) {
      return res.status(409).json(conflictErrorBody('NPC', decodedNpcName, 'created or deleted'));
    }

    handleImageChange(campaign, updatedNpc, existingNpc, existingNpc?.imagePath);

    const action = existingIndex !== -1 ? 'updated' : 'created';
    const stampedNpc = stampForSave(updatedNpc, existingNpc);
    if (existingIndex !== -1) {
      npcs[existingIndex] = stampedNpc;
    } else {
      npcs.push(stampedNpc);
    }

    fs.writeFileSync(npcPath, JSON.stringify(npcs, null, 2));
    broadcastNPCsList(action, campaign, { name: stampedNpc.name });
    res.json({ success: true, npc: stampedNpc });
  } catch (error) {
    console.error('Error updating NPC:', error);
    throw new Error('Failed to update NPC');
  }
}));

export default baseRouter;

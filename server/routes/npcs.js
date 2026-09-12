import path from 'path';
import fs from 'fs';
import { processImageUpload, deleteCharacterImage } from '../utils/imageUtils.js';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignDataFile, campaignImagesDir, ensureDataDir } from '../utils/campaignPaths.js';
import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';

const baseRouter = createJsonEntityRouter('npcs', {
  idField: 'name',
  pluralDisplayName: 'NPCs',
  singularDisplayName: 'NPC',
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

    handleImageChange(campaign, updatedNpc, existingNpc, existingNpc?.imagePath);

    if (existingIndex !== -1) {
      npcs[existingIndex] = updatedNpc;
    } else {
      npcs.push(updatedNpc);
    }

    fs.writeFileSync(npcPath, JSON.stringify(npcs, null, 2));
    res.json({ success: true, npc: updatedNpc });
  } catch (error) {
    console.error('Error updating NPC:', error);
    throw new Error('Failed to update NPC');
  }
}));

export default baseRouter;

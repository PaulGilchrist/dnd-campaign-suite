import fs from 'fs';
import { campaignDataFile, ensureDataDir } from '../utils/campaignPaths.js';
import asyncHandler from '../utils/asyncHandler.js';
import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';
import { findDuplicateNameError } from '../utils/nameUniqueness.js';

const baseRouter = createJsonEntityRouter('settlements', {
  idField: 'name',
  pluralDisplayName: 'settlements',
  singularDisplayName: 'settlement',
  validateList: (settlements) => findDuplicateNameError(settlements, 'settlement'),
});

// PUT /api/campaigns/:campaign/settlements/:settlementName — upsert by name
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

    const existingIndex = settlements.findIndex(s => s.name === decodedName);

    // Duplicate-name guard (mirrors npcs.js PUT guard): a rename must not
    // collide case-insensitively with another settlement's name.
    const newName = (updatedSettlement.name || '').trim();
    if (!newName) {
      return res.status(400).json({ error: 'Settlement name is required' });
    }
    const nameCollision = settlements.find(s =>
      s.name !== decodedName && (s.name || '').toLowerCase() === newName.toLowerCase()
    );
    if (nameCollision) {
      return res.status(400).json({ error: 'A settlement with that name already exists' });
    }

    if (existingIndex !== -1) {
      settlements[existingIndex] = updatedSettlement;
    } else {
      settlements.push(updatedSettlement);
    }

    fs.writeFileSync(filePath, JSON.stringify(settlements, null, 2));
    res.json({ success: true, settlement: updatedSettlement });
  } catch (error) {
    console.error('Error updating settlement:', error);
    throw new Error('Failed to update settlement');
  }
}));

export default baseRouter;

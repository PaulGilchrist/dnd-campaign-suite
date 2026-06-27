import fs from 'fs';
import { campaignDataFile, ensureDataDir } from '../utils/campaignPaths.js';
import asyncHandler from '../utils/asyncHandler.js';
import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';

const baseRouter = createJsonEntityRouter('settlements', {
  idField: 'name',
  pluralDisplayName: 'settlements',
  singularDisplayName: 'settlement',
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

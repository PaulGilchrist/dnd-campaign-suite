import express from 'express';
import { publish } from '../utils/changeData.js';
import { readEncounters, writeEncounters } from '../utils/encounterUtils.js';
import { isLocalHost } from '../utils/jsonEntityCrud.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();

// Draft invisibility (campaign-authoring plan Phase 3): AI-drafted encounters
// are GM planning surfaces — non-GM callers never see them in the list or by
// name (404 like an absent row), mirroring jsonEntityCrud's factory seams.
const isDraft = (enc) => enc?.draft === true;

// GET /api/campaigns/:campaign/encounters - List all encounters
router.get('/api/campaigns/:campaign/encounters', asyncHandler((req, res) => {
  const { campaign } = req.params;
  const data = readEncounters(campaign);
  const visible = isLocalHost(req) ? data.encounters : data.encounters.filter(e => !isDraft(e));
  const encounters = visible.map(e => ({ name: e.name, savedAt: e.savedAt, effectiveXP: e.effectiveXP, draft: e.draft === true || undefined }));
  res.json({ encounters });
}));

// POST /api/campaigns/:campaign/encounters - Create a new encounter
router.post('/api/campaigns/:campaign/encounters', asyncHandler((req, res) => {
  const { campaign } = req.params;
  const { name, data: encounterData } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Encounter name is required' });
  }

  const data = readEncounters(campaign);

  const trimmedName = name.trim();
  if (data.encounters.some(e => e.name === trimmedName)) {
    return res.status(400).json({ error: 'An encounter with this name already exists' });
  }

  const newEncounter = {
    name: trimmedName,
    savedAt: new Date().toISOString(),
    ...encounterData,
    selectedMonsters: (encounterData?.selectedMonsters || []).map(m => ({
      index: m.index,
      name: m.name,
      qty: m.qty
    }))
  };

  data.encounters.push(newEncounter);
  writeEncounters(campaign, data);

  // Broadcast encounters list change
  publish(`encounters-list-${campaign}`, { action: 'created', encounter: { name: trimmedName } }, campaign);

  res.status(201).json({ message: 'Encounter saved successfully', encounter: { name: trimmedName } });
}));

// GET /api/campaigns/:campaign/encounters/:encountername - Get encounter data
router.get('/api/campaigns/:campaign/encounters/:encountername', asyncHandler((req, res) => {
  const { campaign, encountername } = req.params;
  const data = readEncounters(campaign);
  const encounter = data.encounters.find(e => e.name === encountername);
  if (!encounter || (isDraft(encounter) && !isLocalHost(req))) {
    return res.status(404).json({ error: 'Encounter not found' });
  }
  res.json(encounter);
}));

// PUT /api/campaigns/:campaign/encounters/:encountername - Update encounter data
router.put('/api/campaigns/:campaign/encounters/:encountername', asyncHandler((req, res) => {
  const { campaign, encountername } = req.params;
  const encounterData = req.body;

  const data = readEncounters(campaign);
  const index = data.encounters.findIndex(e => e.name === encountername);
  if (index === -1) {
    return res.status(404).json({ error: 'Encounter not found' });
  }

  data.encounters[index] = {
    name: encountername,
    savedAt: data.encounters[index].savedAt,
    ...encounterData,
  };
  writeEncounters(campaign, data);

  // Broadcast encounter data change
  publish(`encounter-data-${campaign}-${encountername}`, encounterData, campaign);

  res.json({ message: 'Encounter updated successfully' });
}));

// DELETE /api/campaigns/:campaign/encounters/:encountername - Delete an encounter
router.delete('/api/campaigns/:campaign/encounters/:encountername', asyncHandler((req, res) => {
  const { campaign, encountername } = req.params;

  const data = readEncounters(campaign);
  const index = data.encounters.findIndex(e => e.name === encountername);
  if (index === -1) {
    return res.status(404).json({ error: 'Encounter not found' });
  }

  data.encounters.splice(index, 1);
  writeEncounters(campaign, data);

  // Broadcast encounters list change
  publish(`encounters-list-${campaign}`, { action: 'deleted', encounter: encountername }, campaign);

  res.json({ message: 'Encounter deleted successfully' });
}));

// PUT /api/campaigns/:campaign/encounters/:encountername/rename - Rename an encounter
router.put('/api/campaigns/:campaign/encounters/:encountername/rename', asyncHandler((req, res) => {
  const { campaign, encountername } = req.params;
  const { newName } = req.body;

  if (!newName || newName.trim() === '') {
    return res.status(400).json({ error: 'New encounter name is required' });
  }

  const data = readEncounters(campaign);
  const index = data.encounters.findIndex(e => e.name === encountername);
  if (index === -1) {
    return res.status(404).json({ error: 'Encounter not found' });
  }

  const trimmedNewName = newName.trim();
  // Check new name doesn't conflict with another encounter
  if (data.encounters.some((e, i) => i !== index && e.name === trimmedNewName)) {
    return res.status(400).json({ error: 'An encounter with this name already exists' });
  }

  data.encounters[index].name = trimmedNewName;
  writeEncounters(campaign, data);

  // Broadcast encounters list change
  publish(`encounters-list-${campaign}`, {
    action: 'renamed',
    oldName: encountername,
    newName: trimmedNewName
  }, campaign);

  res.json({ message: 'Encounter renamed successfully', encounter: { name: trimmedNewName } });
}));

export default router;

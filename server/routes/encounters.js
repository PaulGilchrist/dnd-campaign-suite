import express from 'express';
import { publish } from '../utils/changeData.js';
import { readEncounters, writeEncounters } from '../utils/encounterUtils.js';

const router = express.Router();

// GET /api/campaigns/:campaign/encounters - List all encounters
router.get('/api/campaigns/:campaign/encounters', (req, res) => {
  const { campaign } = req.params;
  try {
    const data = readEncounters(campaign);
    const encounters = data.encounters.map(e => ({ name: e.name, savedAt: e.savedAt }));
    res.json({ encounters });
  } catch (error) {
    console.error('Error listing encounters:', error);
    res.status(500).json({ error: 'Failed to list encounters' });
  }
});

// POST /api/campaigns/:campaign/encounters - Create a new encounter
router.post('/api/campaigns/:campaign/encounters', (req, res) => {
  const { campaign } = req.params;
  const { name, data: encounterData } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Encounter name is required' });
  }

  try {
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
    publish(`encounters-list-${campaign}`, { action: 'created', encounter: { name: trimmedName } });

    res.status(201).json({ message: 'Encounter saved successfully', encounter: { name: trimmedName } });
  } catch (error) {
    console.error('Error saving encounter:', error);
    res.status(500).json({ error: 'Failed to save encounter' });
  }
});

// GET /api/campaigns/:campaign/encounters/:encountername - Get encounter data
router.get('/api/campaigns/:campaign/encounters/:encountername', (req, res) => {
  const { campaign, encountername } = req.params;
  try {
    const data = readEncounters(campaign);
    const encounter = data.encounters.find(e => e.name === encountername);
    if (!encounter) {
      return res.status(404).json({ error: 'Encounter not found' });
    }
    res.json(encounter);
  } catch (error) {
    console.error('Error reading encounter:', error);
    res.status(500).json({ error: 'Failed to read encounter' });
  }
});

// PUT /api/campaigns/:campaign/encounters/:encountername - Update encounter data
router.put('/api/campaigns/:campaign/encounters/:encountername', (req, res) => {
  const { campaign, encountername } = req.params;
  const encounterData = req.body;

  try {
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
    publish(`encounter-data-${campaign}-${encountername}`, encounterData);

    res.json({ message: 'Encounter updated successfully' });
  } catch (error) {
    console.error('Error saving encounter:', error);
    res.status(500).json({ error: 'Failed to save encounter' });
  }
});

// DELETE /api/campaigns/:campaign/encounters/:encountername - Delete an encounter
router.delete('/api/campaigns/:campaign/encounters/:encountername', (req, res) => {
  const { campaign, encountername } = req.params;

  try {
    const data = readEncounters(campaign);
    const index = data.encounters.findIndex(e => e.name === encountername);
    if (index === -1) {
      return res.status(404).json({ error: 'Encounter not found' });
    }

    data.encounters.splice(index, 1);
    writeEncounters(campaign, data);

    // Broadcast encounters list change
    publish(`encounters-list-${campaign}`, { action: 'deleted', encounter: encountername });

    res.json({ message: 'Encounter deleted successfully' });
  } catch (error) {
    console.error('Error deleting encounter:', error);
    res.status(500).json({ error: 'Failed to delete encounter' });
  }
});

// PUT /api/campaigns/:campaign/encounters/:encountername/rename - Rename an encounter
router.put('/api/campaigns/:campaign/encounters/:encountername/rename', (req, res) => {
  const { campaign, encountername } = req.params;
  const { newName } = req.body;

  if (!newName || newName.trim() === '') {
    return res.status(400).json({ error: 'New encounter name is required' });
  }

  try {
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
    });

    res.json({ message: 'Encounter renamed successfully', encounter: { name: trimmedNewName } });
  } catch (error) {
    console.error('Error renaming encounter:', error);
    res.status(500).json({ error: 'Failed to rename encounter' });
  }
});

export default router;

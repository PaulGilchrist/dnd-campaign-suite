import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// GET /api/campaigns/:campaign/factions - List all Factions
router.get('/api/campaigns/:campaign/factions', (req, res) => {
  const { campaign } = req.params;
  const factionPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'factions.json');

  try {
    if (!fs.existsSync(factionPath)) {
      const dataDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(factionPath, JSON.stringify([], null, 2));
      return res.json({ factions: [] });
    }

    const factionData = JSON.parse(fs.readFileSync(factionPath, 'utf-8'));
    const factions = Array.isArray(factionData) ? factionData : [];

    res.json({ factions });
  } catch (error) {
    console.error('Error reading Factions:', error);
    res.status(500).json({ error: 'Failed to read Factions' });
  }
});

// POST /api/campaigns/:campaign/factions - Save all Factions (full array write)
router.post('/api/campaigns/:campaign/factions', (req, res) => {
  const { campaign } = req.params;
  const { factions } = req.body;
  const factionPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'factions.json');

  try {
    const dataDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    fs.writeFileSync(factionPath, JSON.stringify(factions, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving Factions:', error);
    res.status(500).json({ error: 'Failed to save Factions' });
  }
});

// GET /api/campaigns/:campaign/factions/:factionId - Get a specific Faction
router.get('/api/campaigns/:campaign/factions/:factionId', (req, res) => {
  const { campaign, factionId } = req.params;
  const factionPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'factions.json');

  try {
    if (!fs.existsSync(factionPath)) {
      return res.status(404).json({ error: 'Faction not found' });
    }

    const factionData = JSON.parse(fs.readFileSync(factionPath, 'utf-8'));
    const factions = Array.isArray(factionData) ? factionData : [];
    const faction = factions.find(f => f.id === factionId);

    if (!faction) {
      return res.status(404).json({ error: 'Faction not found' });
    }

    res.json({ faction });
  } catch (error) {
    console.error('Error reading Faction:', error);
    res.status(500).json({ error: 'Failed to read Faction' });
  }
});

// DELETE /api/campaigns/:campaign/factions/:factionId - Delete a specific Faction
router.delete('/api/campaigns/:campaign/factions/:factionId', (req, res) => {
  const { campaign, factionId } = req.params;
  const factionPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'factions.json');

  try {
    if (!fs.existsSync(factionPath)) {
      return res.status(404).json({ error: 'Faction not found' });
    }

    const factionData = JSON.parse(fs.readFileSync(factionPath, 'utf-8'));
    const factions = Array.isArray(factionData) ? factionData : [];
    const updatedFactions = factions.filter(f => f.id !== factionId);

    fs.writeFileSync(factionPath, JSON.stringify(updatedFactions, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting Faction:', error);
    res.status(500).json({ error: 'Failed to delete Faction' });
  }
});

export default router;

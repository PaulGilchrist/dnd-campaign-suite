import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// GET /api/campaigns/:campaign/npcs - List all NPCs
router.get('/api/campaigns/:campaign/npcs', (req, res) => {
  const { campaign } = req.params;
  const npcPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'npcs.json');

  try {
    if (!fs.existsSync(npcPath)) {
      const dataDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(npcPath, JSON.stringify([], null, 2));
      return res.json({ npcs: [] });
    }

    const npcData = JSON.parse(fs.readFileSync(npcPath, 'utf-8'));
    const npcs = Array.isArray(npcData) ? npcData : [];

    res.json({ npcs });
  } catch (error) {
    console.error('Error reading NPCs:', error);
    res.status(500).json({ error: 'Failed to read NPCs' });
  }
});

// POST /api/campaigns/:campaign/npcs - Save all NPCs (full array write)
router.post('/api/campaigns/:campaign/npcs', (req, res) => {
  const { campaign } = req.params;
  const { npcs } = req.body;
  const npcPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'npcs.json');

  try {
    const dataDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    fs.writeFileSync(npcPath, JSON.stringify(npcs, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving NPCs:', error);
    res.status(500).json({ error: 'Failed to save NPCs' });
  }
});

// GET /api/campaigns/:campaign/npcs/:npcId - Get a specific NPC
router.get('/api/campaigns/:campaign/npcs/:npcId', (req, res) => {
  const { campaign, npcId } = req.params;
  const npcPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'npcs.json');

  try {
    if (!fs.existsSync(npcPath)) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    const npcData = JSON.parse(fs.readFileSync(npcPath, 'utf-8'));
    const npcs = Array.isArray(npcData) ? npcData : [];
    const npc = npcs.find(n => n.id === npcId);

    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    res.json({ npc });
  } catch (error) {
    console.error('Error reading NPC:', error);
    res.status(500).json({ error: 'Failed to read NPC' });
  }
});

// DELETE /api/campaigns/:campaign/npcs/:npcId - Delete a specific NPC
router.delete('/api/campaigns/:campaign/npcs/:npcId', (req, res) => {
  const { campaign, npcId } = req.params;
  const npcPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'npcs.json');

  try {
    if (!fs.existsSync(npcPath)) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    const npcData = JSON.parse(fs.readFileSync(npcPath, 'utf-8'));
    const npcs = Array.isArray(npcData) ? npcData : [];
    const updatedNpcs = npcs.filter(n => n.id !== npcId);

    fs.writeFileSync(npcPath, JSON.stringify(updatedNpcs, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting NPC:', error);
    res.status(500).json({ error: 'Failed to delete NPC' });
  }
});

export default router;

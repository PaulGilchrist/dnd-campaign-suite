import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// GET /api/campaigns/:campaign/quests - List all quests
router.get('/api/campaigns/:campaign/quests', (req, res) => {
  const { campaign } = req.params;
  const questsPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'quests.json');
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';

  try {
    if (!fs.existsSync(questsPath)) {
      const dataDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(questsPath, JSON.stringify([], null, 2));
      return res.json({ quests: [] });
    }

    const questsData = JSON.parse(fs.readFileSync(questsPath, 'utf-8'));
    const quests = Array.isArray(questsData) ? questsData : [];

    // Filter out all quests for non-localhost users (GM-only feature)
    if (!isLocalhost) {
      return res.json({ quests: [] });
    }

    res.json({ quests });
  } catch (error) {
    console.error('Error reading quests:', error);
    res.status(500).json({ error: 'Failed to read quests' });
  }
});

// POST /api/campaigns/:campaign/quests - Save all quests (full array write)
router.post('/api/campaigns/:campaign/quests', (req, res) => {
  const { campaign } = req.params;
  const { quests } = req.body;
  const questsPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'quests.json');

  try {
    const dataDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    fs.writeFileSync(questsPath, JSON.stringify(quests, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving quests:', error);
    res.status(500).json({ error: 'Failed to save quests' });
  }
});

// GET /api/campaigns/:campaign/quests/:questId - Get a specific quest
router.get('/api/campaigns/:campaign/quests/:questId', (req, res) => {
  const { campaign, questId } = req.params;
  const questsPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'quests.json');
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';

  try {
    if (!fs.existsSync(questsPath)) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    const questsData = JSON.parse(fs.readFileSync(questsPath, 'utf-8'));
    const quests = Array.isArray(questsData) ? questsData : [];
    const quest = quests.find(q => q.id === questId);

    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    // Filter out all quests for non-localhost users (GM-only feature)
    if (!isLocalhost) {
      return res.status(403).json({ error: 'Access denied: GM-only feature' });
    }

    res.json({ quest });
  } catch (error) {
    console.error('Error reading quest:', error);
    res.status(500).json({ error: 'Failed to read quest' });
  }
});

// DELETE /api/campaigns/:campaign/quests/:questId - Delete a specific quest
router.delete('/api/campaigns/:campaign/quests/:questId', (req, res) => {
  const { campaign, questId } = req.params;
  const questsPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'quests.json');

  try {
    if (!fs.existsSync(questsPath)) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    const questsData = JSON.parse(fs.readFileSync(questsPath, 'utf-8'));
    const quests = Array.isArray(questsData) ? questsData : [];
    const updatedQuests = quests.filter(q => q.id !== questId);

    fs.writeFileSync(questsPath, JSON.stringify(updatedQuests, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quest:', error);
    res.status(500).json({ error: 'Failed to delete quest' });
  }
});

export default router;

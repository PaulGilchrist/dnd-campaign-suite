import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.get('/api/campaigns/:campaign/settlements', (req, res) => {
  const { campaign } = req.params;
  const filePath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'settlements.json');

  try {
    if (!fs.existsSync(filePath)) {
      const dataDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      return res.json({ settlements: [] });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const settlements = Array.isArray(data) ? data : [];

    res.json({ settlements });
  } catch (error) {
    console.error('Error reading settlements:', error);
    res.status(500).json({ error: 'Failed to read settlements' });
  }
});

router.post('/api/campaigns/:campaign/settlements', (req, res) => {
  const { campaign } = req.params;
  const { settlements } = req.body;
  const filePath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'settlements.json');

  try {
    const dataDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    fs.writeFileSync(filePath, JSON.stringify(settlements, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving settlements:', error);
    res.status(500).json({ error: 'Failed to save settlements' });
  }
});

router.put('/api/campaigns/:campaign/settlements/:settlementName', (req, res) => {
  const { campaign, settlementName } = req.params;
  const decodedName = decodeURIComponent(settlementName);
  const updatedSettlement = req.body;
  const filePath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'settlements.json');

  try {
    const dataDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

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
    res.status(500).json({ error: 'Failed to update settlement' });
  }
});

router.get('/api/campaigns/:campaign/settlements/:settlementName', (req, res) => {
  const { campaign, settlementName } = req.params;
  const decodedName = decodeURIComponent(settlementName);
  const filePath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'settlements.json');

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const settlements = Array.isArray(data) ? data : [];
    const settlement = settlements.find(s => s.name === decodedName);

    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    res.json({ settlement });
  } catch (error) {
    console.error('Error reading settlement:', error);
    res.status(500).json({ error: 'Failed to read settlement' });
  }
});

router.delete('/api/campaigns/:campaign/settlements/:settlementName', (req, res) => {
  const { campaign, settlementName } = req.params;
  const decodedName = decodeURIComponent(settlementName);
  const filePath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'settlements.json');

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const settlements = Array.isArray(data) ? data : [];
    const updatedSettlements = settlements.filter(s => s.name !== decodedName);

    fs.writeFileSync(filePath, JSON.stringify(updatedSettlements, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting settlement:', error);
    res.status(500).json({ error: 'Failed to delete settlement' });
  }
});

export default router;

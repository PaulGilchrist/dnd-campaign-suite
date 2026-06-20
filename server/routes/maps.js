import express from 'express';
import fs from 'fs';
import path from 'path';
import { publish, activeMaps } from '../utils/changeData.js';

const router = express.Router();

// Helper to sanitize map names to filenames
const sanitizeMapName = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.json';
const toKebabCase = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// GET /api/campaigns/:campaign/maps - List all maps with active status
router.get('/api/campaigns/:campaign/maps', (req, res) => {
  const { campaign } = req.params;
  const mapsDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'maps');
  
  try {
    if (!fs.existsSync(mapsDir)) {
      return res.json({ maps: [] });
    }
    
    const items = fs.readdirSync(mapsDir, { withFileTypes: true });
    const mapFiles = items
      .filter(item => item.isFile() && item.name.endsWith('.json'))
      .map(item => item.name)
      .sort();
    
    const activeMap = activeMaps.get(campaign) || null;
    
    const maps = mapFiles.map(f => {
      let mapType = 'indoor';
      let displayName = f.replace(/\.json$/, '');
      try {
        const mapContent = JSON.parse(fs.readFileSync(path.join(mapsDir, f), 'utf-8'));
        mapType = mapContent.type || 'indoor';
        if (mapContent.displayName) displayName = mapContent.displayName;
      } catch (_e) { /* ignore */ }

      return {
        name: displayName,
        fileName: f,
        type: mapType,
        isActive: f.replace(/\.json$/, '') === activeMap
      };
    });
    
    res.json({ maps });
  } catch (error) {
    console.error('Error listing maps:', error);
    res.status(500).json({ error: 'Failed to list maps' });
  }
});

// POST /api/campaigns/:campaign/maps - Create a new map
router.post('/api/campaigns/:campaign/maps', (req, res) => {
  const { campaign } = req.params;
  const { name, gridSize, walls, placedItems, paintCells, items, players, fog, type = 'indoor', terrain = {}, pois = [], parentHex, parentTerrain, bgFill, rooms, generationMode, description, seed } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Map name is required' });
  }
  
  const mapsDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'maps');
  
  try {
    if (!fs.existsSync(mapsDir)) {
      fs.mkdirSync(mapsDir, { recursive: true });
    }
    
    const fileName = sanitizeMapName(name);
    const filePath = path.join(mapsDir, fileName);
    
    if (fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'A map with this name already exists' });
    }
    
    const defaultMapData = type === 'outdoor'
      ? {
          displayName: name.trim(),
          name: toKebabCase(name.trim()),
          type,
          gridSize: Math.max(5, Math.min(100, gridSize ?? 20)),
          terrain,
          pois,
          zoom: 1,
          panX: 0,
          panY: 0,
        }
      : {
          displayName: name.trim(),
          name: toKebabCase(name.trim()),
          type,
          gridSize: Math.max(5, Math.min(100, gridSize ?? 20)),
          walls: walls ?? [],
          placedItems: placedItems ?? [],
          paintCells: paintCells ?? [],
          items: items ?? [],
          players: players ?? [],
          fog: fog ?? [],
          rooms: rooms ?? [],
          generationMode,
          description,
          seed,
          terrain,
          pois,
          zoom: 1,
          panX: 0,
          panY: 0,
          parentHex,
          parentTerrain,
          bgFill,
        };
    
    fs.writeFileSync(filePath, JSON.stringify(defaultMapData, null, 2));
    
    // Broadcast maps list change
    publish(`maps-list-${campaign}`, { action: 'created', map: { name: name.trim(), fileName } });
    
    res.status(201).json({ message: 'Map created successfully', map: { name: name.trim(), fileName } });
  } catch (error) {
    console.error('Error creating map:', error);
    res.status(500).json({ error: 'Failed to create map' });
  }
});

// GET /api/campaigns/:campaign/maps/:mapname - Get map data
router.get('/api/campaigns/:campaign/maps/:mapname', (req, res) => {
  const { campaign, mapname } = req.params;
  const mapsDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'maps');
  const fileName = mapname.endsWith('.json') ? mapname : `${mapname}.json`;
  const filePath = path.join(mapsDir, fileName);
  
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Map not found' });
    }
    
    const mapData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(mapData);
  } catch (error) {
    console.error('Error reading map:', error);
    res.status(500).json({ error: 'Failed to read map' });
  }
});

// PUT /api/campaigns/:campaign/maps/:mapname - Save map data
router.put('/api/campaigns/:campaign/maps/:mapname', (req, res) => {
  const { campaign, mapname } = req.params;
  const mapData = req.body;
  const mapsDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'maps');
  
  try {
    if (!fs.existsSync(mapsDir)) {
      fs.mkdirSync(mapsDir, { recursive: true });
    }
    
    const fileName = mapname.endsWith('.json') ? mapname : `${mapname}.json`;
    const filePath = path.join(mapsDir, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(mapData, null, 2));
    
    // Broadcast map data change for real-time sync
    const eventMapName = fileName.replace(/\.json$/, '');
    publish(`map-data-${campaign}-${eventMapName}`, mapData);
    
    res.json({ message: 'Map saved successfully' });
  } catch (error) {
    console.error('Error saving map:', error);
    res.status(500).json({ error: 'Failed to save map' });
  }
});

// DELETE /api/campaigns/:campaign/maps/:mapname - Delete a map
router.delete('/api/campaigns/:campaign/maps/:mapname', (req, res) => {
  const { campaign, mapname } = req.params;
  const mapsDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'maps');
  const fileName = mapname.endsWith('.json') ? mapname : `${mapname}.json`;
  const filePath = path.join(mapsDir, fileName);
  
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Map not found' });
    }
    
    fs.unlinkSync(filePath);
    
    // If this was the active map, clear it
    const mapKey = fileName.replace(/\.json$/, '');
    if (activeMaps.get(campaign) === mapKey) {
      activeMaps.delete(campaign);
    }
    
    // Broadcast maps list change
    publish(`maps-list-${campaign}`, { action: 'deleted', map: mapKey });
    
    res.json({ message: 'Map deleted successfully' });
  } catch (error) {
    console.error('Error deleting map:', error);
    res.status(500).json({ error: 'Failed to delete map' });
  }
});

// PUT /api/campaigns/:campaign/maps/:mapname/rename - Rename a map
router.put('/api/campaigns/:campaign/maps/:mapname/rename', (req, res) => {
  const { campaign, mapname } = req.params;
  const { newName } = req.body;
  
  if (!newName || newName.trim() === '') {
    return res.status(400).json({ error: 'New map name is required' });
  }
  
  const mapsDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'maps');
  const oldFileName = mapname.endsWith('.json') ? mapname : `${mapname}.json`;
  const oldFilePath = path.join(mapsDir, oldFileName);
  const newFileName = sanitizeMapName(newName.trim());
  const newFilePath = path.join(mapsDir, newFileName);
  
  try {
    if (!fs.existsSync(oldFilePath)) {
      return res.status(404).json({ error: 'Map not found' });
    }
    
    if (fs.existsSync(newFilePath) && oldFileName !== newFileName) {
      return res.status(400).json({ error: 'A map with this name already exists' });
    }
    
    // Read existing data and update name
    const mapData = JSON.parse(fs.readFileSync(oldFilePath, 'utf-8'));
    mapData.displayName = newName.trim();
    mapData.name = toKebabCase(newName.trim());
    
    // Write with new name, delete old file
    fs.writeFileSync(newFilePath, JSON.stringify(mapData, null, 2));
    
    if (oldFileName !== newFileName) {
      fs.unlinkSync(oldFilePath);
    }
    
    // Update active map in memory if this was the active map
    const oldKey = oldFileName.replace(/\.json$/, '');
    const newKey = newFileName.replace(/\.json$/, '');
    if (activeMaps.get(campaign) === oldKey) {
      activeMaps.set(campaign, newKey);
    }
    
    // Broadcast maps list change
    publish(`maps-list-${campaign}`, { 
      action: 'renamed', 
      oldName: oldFileName.replace(/\.json$/, ''), 
      newName: newFileName.replace(/\.json$/, '') 
    });
    
    res.json({ 
      message: 'Map renamed successfully', 
      map: { name: newName.trim(), fileName: newFileName }
    });
  } catch (error) {
    console.error('Error renaming map:', error);
    res.status(500).json({ error: 'Failed to rename map' });
  }
});

// PUT /api/campaigns/:campaign/maps/:mapname/activate - Activate a map
router.put('/api/campaigns/:campaign/maps/:mapname/activate', (req, res) => {
  const { campaign, mapname } = req.params;
  const mapsDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'maps');
  const fileName = mapname.endsWith('.json') ? mapname : `${mapname}.json`;
  const filePath = path.join(mapsDir, fileName);
  
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Map not found' });
    }
    
    const mapKey = fileName.replace(/\.json$/, '');
    activeMaps.set(campaign, mapKey);
    
    // Broadcast activation change
    publish(`map-activate-${campaign}`, { activeMap: mapKey });
    publish(`maps-list-${campaign}`, { action: 'activated', activeMap: mapKey });
    
    res.json({ message: 'Map activated successfully', activeMap: mapKey });
  } catch (error) {
    console.error('Error activating map:', error);
    res.status(500).json({ error: 'Failed to activate map' });
  }
});

// GET /api/campaigns/:campaign/active-map - Get the active map name
router.get('/api/campaigns/:campaign/active-map', (req, res) => {
  const { campaign } = req.params;
  const activeMapName = activeMaps.get(campaign) || null;
  res.json({ activeMapName });
});

// PUT /api/campaigns/:campaign/maps/:mapname/description - Update map description
router.put('/api/campaigns/:campaign/maps/:mapname/description', (req, res) => {
  const { campaign, mapname } = req.params;
  const { description } = req.body;
  const mapsDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'maps');
  const fileName = mapname.endsWith('.json') ? mapname : `${mapname}.json`;
  const filePath = path.join(mapsDir, fileName);
  
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Map not found' });
    }
    
    const mapData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    mapData.description = description || '';
    fs.writeFileSync(filePath, JSON.stringify(mapData, null, 2));
    
    // Broadcast updated map data
    publish(`map-data-${campaign}-${fileName.replace(/\.json$/, '')}`, mapData);
    
    res.json({ message: 'Map description updated successfully' });
  } catch (error) {
    console.error('Error updating map description:', error);
    res.status(500).json({ error: 'Failed to update map description' });
  }
});

export default router;

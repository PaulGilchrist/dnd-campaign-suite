// API for saving character changes like Gold, Hit Points, Initiative Order, Inspiration, Classes, Barbarian Rage Points, Bard Inpiration Uses, Cleric Channel Divinity Charges, Fighter Action Surges, Fighter Indomitable Uses, Monk Ki Points, Sorcerer Sorcery Points, Wizard Arcane Recovery Levels, Spell Slots, Spells Prepared
// Changes are cached in memory, and batch persisted to disk (backed up) at a configurable interval
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import guid from 'guid'
import http from 'http';

const PORT = process.env.PORT || 80;
const persistDataDebounceMilliseconds = 1 * 60 * 1000; // 1 minute in milliseconds

const app = express();

// Increase JSON body limit to accommodate base64 image uploads
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Connection, Content-Type, Authorization');
    next();
});

// Serve your React build (dist folder) BEFORE API routes
app.use(express.static(path.join(process.cwd(), 'dist')));

// SSE endpoint — must be BEFORE the catch-all fallback route
app.get('/subscribe', (req, res) => {
    const headers = {
          'Content-Type': 'text/event-stream',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache'
      };
    res.writeHead(200, headers);
    const clientId = guid.create().value;
    const newClient = {
        id: clientId,
        res
     };
    subscribers.push(newClient);
    req.on('close', () => {
        console.log(`${clientId} Connection closed`);
        subscribers = subscribers.filter(client => client.id !== clientId);
     });
    console.log(`Current subscriber count = ${subscribers.length}`)
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Healthy' });
});

// React Router fallback — MUST be last
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
});


// Start server
app.listen(PORT, () => {
      // Get local network IP (e.g., 192.168.x.x)
    const interfaces = os.networkInterfaces();
    let lanIP = 'unknown';

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                lanIP = iface.address;
     }
           }
     }

    // Only show port and trailing slash if it's not the default (80)
    const portStr = PORT === 80 ? '' : `:${PORT}`;
    const trailingSlash = PORT === 80 ? '' : '/';

    console.log(`Server running at:`);
    console.log(`  Local:   http://localhost${portStr}${trailingSlash}`);
    console.log(`  Network: http://${lanIP}${portStr}${trailingSlash}`);
});

// Serve static files from the public directory
app.use(express.static(path.join(process.cwd(), 'public')));

// Helper function to process image uploads from character data
// originalImagePath: the imagePath from the original character file (optional)
const processImageUpload = (campaignName, characterName, character, originalImagePath) => {
    if (character.image && character.imageName) {
        // Extract the file extension from imageName (e.g., "photo.jpg" -> ".jpg")
        const extMatch = character.imageName.match(/\.[^.]+$/);
        const ext = extMatch ? extMatch[0] : '.png';

        const campaignImagesDir = path.join(process.cwd(), 'public', 'campaigns', campaignName, 'images');
        if (!fs.existsSync(campaignImagesDir)) {
            fs.mkdirSync(campaignImagesDir, { recursive: true });
        }

        // Use character name as filename
        const imageFileName = `${characterName}${ext}`;
        const imageFilePath = path.join(campaignImagesDir, imageFileName);

        // Delete old image if provided
        if (originalImagePath) {
            deleteCharacterImage(originalImagePath);
        }

        // Extract base64 data from data URL (e.g., "data:image/png;base64,iVBORw...")
        const base64Data = character.image.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

        // Save the image file
        fs.writeFileSync(imageFilePath, base64Data, 'base64');

        // Set the relative path from public/
        character.imagePath = path.join('campaigns', campaignName, 'images', imageFileName);

        // Remove the temporary image and imageName fields from the character object
        delete character.image;
        delete character.imageName;

        console.log(`Image saved: ${imageFilePath}`);
    }
};

// Helper function to delete associated image file for a character
const deleteCharacterImage = (imagePath) => {
    try {
        if (imagePath) {
            // imagePath is relative to public/ e.g. "campaigns/<campaign>/images/<name>.<ext>"
            const fullPath = path.join(process.cwd(), 'public', imagePath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                console.log(`Deleted image: ${fullPath}`);
            }
        }
    } catch (error) {
        console.error('Error deleting character image:', error);
    }
};

// API endpoint to list character folders
app.get('/api/campaigns', (req, res) => {
    const campaignsDir = path.join(process.cwd(), 'public', 'campaigns');
    
    try {
        const items = fs.readdirSync(campaignsDir, { withFileTypes: true });
        const folders = items
            .filter(item => item.isDirectory())
            .map(item => item.name)
            .sort();
        
        res.json({ folders });
    } catch (error) {
        console.error('Error reading campaigns directory:', error);
        res.status(500).json({ error: 'Failed to read campaigns directory' });
    }
});

// API endpoint to list character files in a specific campaign
app.get('/api/campaigns/:campaign', (req, res) => {
    const { campaign } = req.params;
    const campaignDir = path.join(process.cwd(), 'public', 'campaigns', campaign);
    
    try {
        const items = fs.readdirSync(campaignDir, { withFileTypes: true });
        const files = items
            .filter(item => item.isFile() && item.name.endsWith('.json'))
            .map(item => item.name)
            .sort();
        
        res.json({ files });
    } catch (error) {
        console.error('Error reading campaign directory:', error);
        res.status(500).json({ error: 'Failed to read campaign directory' });
    }
});

// ====== MAP CRUD ROUTES ======

// Helper to sanitize map names to filenames
const sanitizeMapName = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.json';

// GET /api/campaigns/:campaign/maps - List all maps with active status
app.get('/api/campaigns/:campaign/maps', (req, res) => {
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
      // Read the type field from the map file
      let mapType = 'indoor';
      try {
        const mapContent = JSON.parse(fs.readFileSync(path.join(mapsDir, f), 'utf-8'));
        mapType = mapContent.type || 'indoor';
      } catch (e) { /* ignore - default to indoor */ }

      return {
        name: f.replace(/\.json$/, ''),
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
app.post('/api/campaigns/:campaign/maps', (req, res) => {
  const { campaign } = req.params;
  const { name, gridSize, walls, placedItems, paintCells, items, players, type = 'indoor', terrain = {}, pois = [] } = req.body;
  
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
    
    const defaultMapData = {
      name: name.trim(),
      type,
      gridSize: Math.max(5, Math.min(100, gridSize ?? 20)),
      walls: walls ?? [],
      placedItems: placedItems ?? [],
      paintCells: paintCells ?? [],
      items: items ?? [],
      players: players ?? [],
      terrain,
      pois,
      zoom: 1,
      panX: 0,
      panY: 0
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
app.get('/api/campaigns/:campaign/maps/:mapname', (req, res) => {
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
app.put('/api/campaigns/:campaign/maps/:mapname', (req, res) => {
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
app.delete('/api/campaigns/:campaign/maps/:mapname', (req, res) => {
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
app.put('/api/campaigns/:campaign/maps/:mapname/rename', (req, res) => {
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
    mapData.name = newName.trim();
    
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
app.put('/api/campaigns/:campaign/maps/:mapname/activate', (req, res) => {
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

// PUT /api/campaigns/:campaign/maps/:mapname/description - Update map description
app.put('/api/campaigns/:campaign/maps/:mapname/description', (req, res) => {
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

// ====== END MAP CRUD ROUTES ======

// ====== ENCOUNTER CRUD ROUTES ======

// Helper to get the encounters file path
const getEncountersFilePath = (campaign) => path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'encounters.json');

// Helper to read encounters from single file
const readEncounters = (campaign) => {
  const filePath = getEncountersFilePath(campaign);
  try {
    if (!fs.existsSync(filePath)) {
      return { encounters: [] };
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.error('Error reading encounters file:', error);
    return { encounters: [] };
  }
};

// Helper to write encounters to single file
const writeEncounters = (campaign, data) => {
  const filePath = getEncountersFilePath(campaign);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// GET /api/campaigns/:campaign/encounters - List all encounters
app.get('/api/campaigns/:campaign/encounters', (req, res) => {
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
app.post('/api/campaigns/:campaign/encounters', (req, res) => {
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
app.get('/api/campaigns/:campaign/encounters/:encountername', (req, res) => {
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
app.put('/api/campaigns/:campaign/encounters/:encountername', (req, res) => {
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
app.delete('/api/campaigns/:campaign/encounters/:encountername', (req, res) => {
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
app.put('/api/campaigns/:campaign/encounters/:encountername/rename', (req, res) => {
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

// ====== END ENCOUNTER CRUD ROUTES ======

// ====== NOTES ROUTES ======

// GET /api/campaigns/:campaign/notes - List all notes
app.get('/api/campaigns/:campaign/notes', (req, res) => {
  const { campaign } = req.params;
  const notesPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'notes.json');
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';

  try {
    if (!fs.existsSync(notesPath)) {
      // Create data directory and empty notes file if it doesn't exist
      const dataDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(notesPath, JSON.stringify([], null, 2));
      return res.json({ notes: [] });
    }

    const notesData = JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
    const notes = Array.isArray(notesData) ? notesData : [];

    // Filter out private notes for non-localhost users
    if (!isLocalhost) {
      const filteredNotes = notes.filter(note => !note.isPrivate);
      return res.json({ notes: filteredNotes });
    }

    res.json({ notes });
  } catch (error) {
    console.error('Error reading notes:', error);
    res.status(500).json({ error: 'Failed to read notes' });
  }
});

// POST /api/campaigns/:campaign/notes - Save all notes (full array write)
app.post('/api/campaigns/:campaign/notes', (req, res) => {
  const { campaign } = req.params;
  const { notes } = req.body;
  const notesPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'notes.json');

  try {
    const dataDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    fs.writeFileSync(notesPath, JSON.stringify(notes, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving notes:', error);
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

// GET /api/campaigns/:campaign/notes/:noteId - Get a specific note
app.get('/api/campaigns/:campaign/notes/:noteId', (req, res) => {
  const { campaign, noteId } = req.params;
  const notesPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'notes.json');
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';

  try {
    if (!fs.existsSync(notesPath)) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const notesData = JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
    const notes = Array.isArray(notesData) ? notesData : [];
    const note = notes.find(n => n.id === noteId);

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check if note is private and user is not localhost
    if (!isLocalhost && note.isPrivate) {
      return res.status(403).json({ error: 'Access denied: private note' });
    }

    res.json({ note });
  } catch (error) {
    console.error('Error reading note:', error);
    res.status(500).json({ error: 'Failed to read note' });
  }
});

// DELETE /api/campaigns/:campaign/notes/:noteId - Delete a specific note
app.delete('/api/campaigns/:campaign/notes/:noteId', (req, res) => {
  const { campaign, noteId } = req.params;
  const notesPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'notes.json');

  try {
    if (!fs.existsSync(notesPath)) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const notesData = JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
    const notes = Array.isArray(notesData) ? notesData : [];
    const updatedNotes = notes.filter(n => n.id !== noteId);

    fs.writeFileSync(notesPath, JSON.stringify(updatedNotes, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// ====== END NOTES ROUTES ======

// ====== NPC ROUTES ======

// GET /api/campaigns/:campaign/npcs - List all NPCs
app.get('/api/campaigns/:campaign/npcs', (req, res) => {
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
app.post('/api/campaigns/:campaign/npcs', (req, res) => {
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
app.get('/api/campaigns/:campaign/npcs/:npcId', (req, res) => {
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
app.delete('/api/campaigns/:campaign/npcs/:npcId', (req, res) => {
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

// ====== END NPC ROUTES ======

// ====== QUESTS ROUTES ======

// GET /api/campaigns/:campaign/quests - List all quests
app.get('/api/campaigns/:campaign/quests', (req, res) => {
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
app.post('/api/campaigns/:campaign/quests', (req, res) => {
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
app.get('/api/campaigns/:campaign/quests/:questId', (req, res) => {
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
app.delete('/api/campaigns/:campaign/quests/:questId', (req, res) => {
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

// ====== END QUESTS ROUTES ======

// ====== FACTION ROUTES ======

// GET /api/campaigns/:campaign/factions - List all Factions
app.get('/api/campaigns/:campaign/factions', (req, res) => {
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
app.post('/api/campaigns/:campaign/factions', (req, res) => {
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
app.get('/api/campaigns/:campaign/factions/:factionId', (req, res) => {
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
app.delete('/api/campaigns/:campaign/factions/:factionId', (req, res) => {
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

// ====== END FACTION ROUTES ======

// API endpoint to get a specific character file in a campaign
app.get('/api/campaigns/:campaign/:file', (req, res) => {
    const { campaign, file } = req.params;
    const campaignDir = path.join(process.cwd(), 'public', 'campaigns', campaign);
    const filePath = path.join(campaignDir, file);
    
    try {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Character file not found' });
        }
        
        const characterData = fs.readFileSync(filePath, 'utf-8');
        res.json(JSON.parse(characterData));
    } catch (error) {
        console.error('Error reading character file:', error);
        res.status(500).json({ error: 'Failed to read character file' });
    }
});

const readFile = () => {
    const campaignsDir = path.join(process.cwd(), 'public', 'campaigns');
    try {
        if (!fs.existsSync(campaignsDir)) return;
        const campaigns = fs.readdirSync(campaignsDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);
        for (const campaign of campaigns) {
            const filePath = path.join(campaignsDir, campaign, 'data', 'character-change-data.json');
            try {
                if (fs.existsSync(filePath)) {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    characterChangeData.set(campaign, data);
                } else {
                    characterChangeData.set(campaign, {});
                }
            } catch (err) {
                console.error(`Failed to read character change data for campaign ${campaign}:`, err.message);
                characterChangeData.set(campaign, {});
            }
        }
    } catch (err) {
        console.error('Failed to read campaigns directory for character change data:', err.message);
    }
}
const saveFile = () => {
    for (const [campaign, data] of characterChangeData) {
        const filePath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'character-change-data.json');
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFile(filePath, JSON.stringify(data), (err) => {
            if (err) {
                console.error(`Failed to save character change data for campaign ${campaign}:`, err.message);
            }
        });
    }
}
// API endpoint to create a new campaign folder (must be BEFORE wildcard routes)
app.post('/api/campaigns', (req, res) => {
    const { campaignName } = req.body;
    
    if (!campaignName || campaignName.trim() === '') {
        return res.status(400).json({ error: 'Campaign name is required' });
    }
    
    const campaignsDir = path.join(process.cwd(), 'public', 'campaigns');
    const newCampaignDir = path.join(campaignsDir, campaignName.trim());
    
    try {
        if (fs.existsSync(newCampaignDir)) {
            return res.status(400).json({ error: 'Campaign already exists' });
        }
        
        fs.mkdirSync(newCampaignDir);
        // Create maps subdirectory for campaign map files
        fs.mkdirSync(path.join(newCampaignDir, 'maps'), { recursive: true });
        // Create images subdirectory for character images
        fs.mkdirSync(path.join(newCampaignDir, 'images'), { recursive: true });
        // Create data subdirectory for character change data
        fs.mkdirSync(path.join(newCampaignDir, 'data'), { recursive: true });
        
        res.status(201).json({ message: 'Campaign created successfully', campaignName: campaignName.trim() });
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

// API endpoint to update an existing character in a campaign
app.put('/api/campaigns/:campaign/:file', (req, res) => {
    const { campaign, file } = req.params;
    const character = req.body;
    
    if (!campaign || !file || !character) {
        return res.status(400).json({ error: 'Campaign, file, and character data are required' });
    }
    
    const campaignDir = path.join(process.cwd(), 'public', 'campaigns', campaign);
    const filePath = path.join(campaignDir, file);
    
    try {
        const isRename = character.originalFileName && character.originalFileName !== file;
        
        if (isRename) {
            // Renaming: read from the original file path
            const originalFilePath = path.join(campaignDir, character.originalFileName);
            if (!fs.existsSync(originalFilePath)) {
                return res.status(404).json({ error: 'Character file not found' });
            }

            // Read the original character to get the imagePath for image cleanup
            const originalCharacter = JSON.parse(fs.readFileSync(originalFilePath, 'utf-8'));
            const originalImagePath = originalCharacter.imagePath;

            // Delete the original character file
            fs.unlinkSync(originalFilePath);

            // Handle image changes
            if ((!character.imagePath || character.imagePath === '') && originalImagePath) {
                // Image was cleared
                deleteCharacterImage(originalImagePath);
                character.imagePath = '';
            } else if (character.image && character.imageName) {
                // New image uploaded
                processImageUpload(campaign, character.name, character, originalImagePath);
            } else if (originalImagePath) {
                // Image unchanged but character renamed — rename the image file
                const oldImageFullPath = path.join(process.cwd(), 'public', originalImagePath);
                if (fs.existsSync(oldImageFullPath)) {
                    const ext = path.extname(oldImageFullPath);
                    const newImageFileName = `${character.name}${ext}`;
                    const newCampaignImagesDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'images');
                    const newImageFullPath = path.join(newCampaignImagesDir, newImageFileName);

                    if (oldImageFullPath !== newImageFullPath) {
                        fs.renameSync(oldImageFullPath, newImageFullPath);
                        character.imagePath = path.join('campaigns', campaign, 'images', newImageFileName);
                    }
                }
            }
        } else {
            // Standard update: verify the file exists at the current path
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Character file not found' });
            }

            // Read the original character to get the imagePath for image cleanup
            const originalCharacter = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const originalImagePath = originalCharacter.imagePath;

            // Handle image changes
            if ((!character.imagePath || character.imagePath === '') && originalImagePath) {
                deleteCharacterImage(originalImagePath);
                character.imagePath = '';
            } else if (character.image && character.imageName) {
                processImageUpload(campaign, character.name, character, originalImagePath);
            }
        }
        
        fs.writeFileSync(filePath, JSON.stringify(character, null, 2));
        
        res.status(200).json({ 
            message: 'Character updated successfully', 
            character: character
        });
    } catch (error) {
        console.error('Error updating character:', error);
        res.status(500).json({ error: 'Failed to update character' });
    }
});

// API endpoint to delete a character in a campaign
app.delete('/api/campaigns/:campaign/:file', (req, res) => {
    const { campaign, file } = req.params;
    const campaignDir = path.join(process.cwd(), 'public', 'campaigns', campaign);
    const filePath = path.join(campaignDir, file);
    
    try {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Character file not found' });
         }

        // Read the character file to check for an associated image
        const characterData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        deleteCharacterImage(characterData.imagePath);
        
        fs.unlinkSync(filePath);
        
        res.status(200).json({ message: 'Character deleted successfully' });
     } catch (error) {
        console.error('Error deleting character:', error);
        res.status(500).json({ error: 'Failed to delete character' });
     }
});

// API endpoint to delete a campaign
app.delete('/api/campaigns/:campaign', (req, res) => {
    const { campaign } = req.params;
    const campaignDir = path.join(process.cwd(), 'public', 'campaigns', campaign);
    
    try {
        if (!fs.existsSync(campaignDir)) {
            return res.status(404).json({ error: 'Campaign not found' });
         }
        
        // Before deleting the campaign dir, read all .json files and delete associated images
        const files = fs.readdirSync(campaignDir);
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const characterData = JSON.parse(fs.readFileSync(path.join(campaignDir, file), 'utf-8'));
                if (characterData.imagePath) {
                    deleteCharacterImage(characterData.imagePath);
                }
            }
        });

        // Delete maps directory and all map files recursively
        const mapsDir = path.join(campaignDir, 'maps');
        if (fs.existsSync(mapsDir)) {
            const mapFiles = fs.readdirSync(mapsDir);
            mapFiles.forEach(f => fs.unlinkSync(path.join(mapsDir, f)));
            fs.rmdirSync(mapsDir);
        }

        // Delete images directory and all image files recursively
        const imagesDir = path.join(campaignDir, 'images');
        if (fs.existsSync(imagesDir)) {
            fs.rmSync(imagesDir, { recursive: true, force: true });
        }

        // Remove all files in the campaign directory
        files.forEach(file => {
            if (file !== 'maps' && file !== 'images') {
                fs.unlinkSync(path.join(campaignDir, file));
            }
         });
        
        // Remove the campaign directory
        fs.rmdirSync(campaignDir);
        
        res.status(200).json({ message: 'Campaign deleted successfully' });
     } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: 'Failed to delete campaign' });
     }
});

// API endpoint to rename a campaign
app.put('/api/campaigns/:campaign', (req, res) => {
    const { campaign } = req.params;
    const { newName } = req.body;
    
    if (!newName || newName.trim() === '') {
        return res.status(400).json({ error: 'New campaign name is required' });
     }
    
    // Validate campaign name - only allow alphanumeric, spaces, hyphens, underscores, and periods
    const campaignNamePattern = /^[a-zA-Z0-9 _.\-]+$/;
    if (!campaignNamePattern.test(newName.trim())) {
        return res.status(400).json({ error: 'Campaign name can only contain letters, numbers, spaces, hyphens, underscores, and periods' });
      }
    
    const campaignsDir = path.join(process.cwd(), 'public', 'campaigns');
    const oldCampaignDir = path.join(campaignsDir, decodeURIComponent(campaign));
    const newCampaignDir = path.join(campaignsDir, newName.trim());
    
    try {
        if (!fs.existsSync(oldCampaignDir)) {
            return res.status(404).json({ error: 'Campaign not found' });
         }
        
        if (fs.existsSync(newCampaignDir)) {
            return res.status(400).json({ error: 'Campaign with this name already exists' });
         }
        
        // Rename the campaign directory
        fs.renameSync(oldCampaignDir, newCampaignDir);
        
        res.status(200).json({ message: 'Campaign renamed successfully', newName: newName.trim() });
     } catch (error) {
        console.error('Error renaming campaign:', error);
        res.status(500).json({ error: 'Failed to rename campaign' });
     }
});

// API endpoint to create a new character in the selected campaign
app.post('/api/campaigns/character', (req, res) => {
    const { campaignName, character } = req.body;
    
    
    if (!campaignName || !character) {
        console.error('Missing campaignName or character');
        return res.status(400).json({ error: 'Campaign name and character data are required' });
    }
    
    const campaignsDir = path.join(process.cwd(), 'public', 'campaigns');
    const campaignDir = path.join(campaignsDir, campaignName.trim());
    
    
    try {
        if (!fs.existsSync(campaignDir)) {
            console.error('Campaign directory does not exist:', campaignDir);
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // If the character has an image, process the upload
        processImageUpload(campaignName, character.name, character);
        
        // Generate a safe filename using only character name
        const charName = character.name || 'Character';
        const fileName = `${charName.toLowerCase().replace(/\s+/g, '-')}.json`;
        const filePath = path.join(campaignDir, fileName);
        
        
        // Check if file already exists
        if (fs.existsSync(filePath)) {
            console.error('Character file already exists:', filePath);
            return res.status(400).json({ error: 'Character with this name already exists' });
        }
        
        // Write character data to file
        fs.writeFileSync(filePath, JSON.stringify(character, null, 2));
        res.status(201).json({ 
            message: 'Character created successfully', 
            character: character,
            filename: fileName 
         });
     } catch (error) {
        console.error('Error creating character:', error);
        res.status(500).json({ error: 'Failed to create character' });
    }
});
// API endpoint to get positioning data for a campaign
app.get('/api/campaigns/:campaign/positioning', (req, res) => {
    const { campaign } = req.params;
    const campaignData = characterChangeData.get(campaign) || {};
    const storedData = campaignData.positioning;
    if (storedData) {
        res.status(200).json(storedData);
    } else {
        res.status(200).json({ players: [] });
    }
});

// API endpoint to save positioning data for a campaign
app.post('/api/campaigns/:campaign/positioning', (req, res) => {
    const { campaign } = req.params;
    const positioningData = req.body;
    if (!characterChangeData.has(campaign)) {
        characterChangeData.set(campaign, {});
    }
    characterChangeData.get(campaign).positioning = positioningData;
    res.status(200).json({ message: 'Positioning data stored successfully' });
    if (!saveTimer) {
        saveTimer = setTimeout(() => {
            saveFile();
            clearTimeout(saveTimer);
            saveTimer = null;
        }, persistDataDebounceMilliseconds);
    }
    publish(`positioning-${campaign}`, positioningData);
});

// Wildcard routes for character data (must be AFTER /api/campaigns)
app.get('/api/campaigns/:campaign/:key', (req, res) => {
    const { campaign, key } = req.params;
    const campaignData = characterChangeData.get(campaign) || {};
    const storedData = campaignData[key];
    if (storedData) {
        res.status(200).json(storedData);
    } else {
        res.status(404).json({ error: 'Data not found' });
    }
});
app.post('/api/campaigns/:campaign/:key', (req, res) => {
    const { campaign, key } = req.params;
    const data = req.body?.value ?? req.body;
    if (!characterChangeData.has(campaign)) {
        characterChangeData.set(campaign, {});
    }
    characterChangeData.get(campaign)[key] = data;
    res.status(200).json({ message: 'Data stored successfully' });
    if (!saveTimer) {
        saveTimer = setTimeout(() => {
            saveFile();
            clearTimeout(saveTimer);
            saveTimer = null;
        }, persistDataDebounceMilliseconds);
    }
    publish(key, data);
});

const publish = (key, data) => {
    const event = {
        key,
        data
    }
    subscribers.forEach(subscriber => subscriber.res.write(`data: ${JSON.stringify(event)}\n\n`));
}

const keepAlive = () => {
    http.get(`http://localhost:${PORT}/health`, (res) => {
        if (res.statusCode === 200) {
            console.log('Health check passed');
        }
    }).on('error', (error) => {
        console.error(`Health check error: ${error.message}`);
    });
}
setInterval(keepAlive, 60000); // 60 seconds

// React Router fallback — MUST be last
app.get(/^\/dnd-char-sheet\/.*/, (req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
});

let characterChangeData = new Map()
let activeMaps = new Map(); // campaign -> activeMap key
let subscribers = [];
readFile(); // Read once at startup
let saveTimer = null;

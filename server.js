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

// Ensure the character-images directory exists
const characterImagesDir = path.join(process.cwd(), 'public', 'character-images');
if (!fs.existsSync(characterImagesDir)) {
    fs.mkdirSync(characterImagesDir, { recursive: true });
}

// Helper function to process image uploads from character data
// originalImagePath: the imagePath from the original character file (optional)
const processImageUpload = (character, originalImagePath) => {
    if (character.image && character.imageName) {
        // Extract the file extension from imageName (e.g., "photo.jpg" -> ".jpg")
        const extMatch = character.imageName.match(/\.[^.]+$/);
        const ext = extMatch ? extMatch[0] : '.png';

        // Generate a GUID-based filename
        const guidValue = guid.create().value;
        const imageFileName = `${guidValue}${ext}`;
        const imageFilePath = path.join(characterImagesDir, imageFileName);

        // Delete the old image if originalImagePath is provided and differs
        if (originalImagePath) {
            deleteCharacterImage(originalImagePath);
        }

        // Extract base64 data from data URL (e.g., "data:image/png;base64,iVBORw...")
        const base64Data = character.image.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

        // Save the image file
        fs.writeFileSync(imageFilePath, base64Data, 'base64');

        // Set the relative path for the image
        character.imagePath = `character-images/${imageFileName}`;

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
            // imagePath is relative like "character-images/{guid}.{ext}"
            const imageFileName = path.basename(imagePath);
            const imageFilePath = path.join(characterImagesDir, imageFileName);
            if (fs.existsSync(imageFilePath)) {
                fs.unlinkSync(imageFilePath);
                console.log(`Deleted image: ${imageFilePath}`);
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
    
    // Read active map from meta file
    let activeMap = null;
    const metaPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'maps', 'maps-meta.json');
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        activeMap = meta.activeMap || null;
      } catch (e) {}
    }
    
    const maps = mapFiles.map(f => ({
      name: f.replace(/\.json$/, ''),
      fileName: f,
      isActive: f.replace(/\.json$/, '') === activeMap
    }));
    
    res.json({ maps });
  } catch (error) {
    console.error('Error listing maps:', error);
    res.status(500).json({ error: 'Failed to list maps' });
  }
});

// POST /api/campaigns/:campaign/maps - Create a new map
app.post('/api/campaigns/:campaign/maps', (req, res) => {
  const { campaign } = req.params;
  const { name, gridSize, walls, placedItems } = req.body;
  
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
      gridSize: Math.max(5, Math.min(100, gridSize ?? 20)),
      walls: walls ?? [],
      placedItems: placedItems ?? [],
      paintCells: [],
      items: [],
      creatures: [],
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
    
    // If this was the active map, clear active map in meta
    const metaPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'maps', 'maps-meta.json');
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const mapKey = fileName.replace(/\.json$/, '');
        if (meta.activeMap === mapKey) {
          delete meta.activeMap;
          fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        }
      } catch (e) {}
    }
    
    // Broadcast maps list change
    const mapKey = fileName.replace(/\.json$/, '');
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
    
    // Update maps-meta.json if this was the active map
    const metaPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'maps', 'maps-meta.json');
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const oldKey = oldFileName.replace(/\.json$/, '');
        const newKey = newFileName.replace(/\.json$/, '');
        if (meta.activeMap === oldKey) {
          meta.activeMap = newKey;
          fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        }
      } catch (e) {}
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
    const metaPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'maps', 'maps-meta.json');
    const meta = { activeMap: mapKey };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    
    // Broadcast activation change
    publish(`map-activate-${campaign}`, { activeMap: mapKey });
    publish(`maps-list-${campaign}`, { action: 'activated', activeMap: mapKey });
    
    res.json({ message: 'Map activated successfully', activeMap: mapKey });
  } catch (error) {
    console.error('Error activating map:', error);
    res.status(500).json({ error: 'Failed to activate map' });
  }
});

// ====== END MAP CRUD ROUTES ======

// ====== ENCOUNTER CRUD ROUTES ======

// Helper to sanitize encounter names to filenames
const sanitizeEncounterName = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.json';

// GET /api/campaigns/:campaign/encounters - List all encounters
app.get('/api/campaigns/:campaign/encounters', (req, res) => {
  const { campaign } = req.params;
  const encountersDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'encounters');
  
  try {
    if (!fs.existsSync(encountersDir)) {
      return res.json({ encounters: [] });
    }
    
    const items = fs.readdirSync(encountersDir, { withFileTypes: true });
    const encounterFiles = items
      .filter(item => item.isFile() && item.name.endsWith('.json'))
      .map(item => item.name)
      .sort();
    
    const encounters = encounterFiles.map(f => ({
      name: f.replace(/\.json$/, ''),
      fileName: f,
    }));
    
    res.json({ encounters });
  } catch (error) {
    console.error('Error listing encounters:', error);
    res.status(500).json({ error: 'Failed to list encounters' });
  }
});

// POST /api/campaigns/:campaign/encounters - Create a new encounter
app.post('/api/campaigns/:campaign/encounters', (req, res) => {
  const { campaign } = req.params;
  const { name, data } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Encounter name is required' });
  }
  
  const encountersDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'encounters');
  
  try {
    if (!fs.existsSync(encountersDir)) {
      fs.mkdirSync(encountersDir, { recursive: true });
    }
    
    const fileName = sanitizeEncounterName(name);
    const filePath = path.join(encountersDir, fileName);
    
    if (fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'An encounter with this name already exists' });
    }
    
    const encounterData = {
      name: name.trim(),
      savedAt: new Date().toISOString(),
      ...data,
    };
    
    fs.writeFileSync(filePath, JSON.stringify(encounterData, null, 2));
    
    // Broadcast encounters list change
    publish(`encounters-list-${campaign}`, { action: 'created', encounter: { name: name.trim(), fileName } });
    
    res.status(201).json({ message: 'Encounter saved successfully', encounter: { name: name.trim(), fileName } });
  } catch (error) {
    console.error('Error saving encounter:', error);
    res.status(500).json({ error: 'Failed to save encounter' });
  }
});

// GET /api/campaigns/:campaign/encounters/:encountername - Get encounter data
app.get('/api/campaigns/:campaign/encounters/:encountername', (req, res) => {
  const { campaign, encountername } = req.params;
  const encountersDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'encounters');
  const fileName = encountername.endsWith('.json') ? encountername : `${encountername}.json`;
  const filePath = path.join(encountersDir, fileName);
  
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Encounter not found' });
    }
    
    const encounterData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(encounterData);
  } catch (error) {
    console.error('Error reading encounter:', error);
    res.status(500).json({ error: 'Failed to read encounter' });
  }
});

// PUT /api/campaigns/:campaign/encounters/:encountername - Update encounter data
app.put('/api/campaigns/:campaign/encounters/:encountername', (req, res) => {
  const { campaign, encountername } = req.params;
  const encounterData = req.body;
  const encountersDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'encounters');
  
  try {
    if (!fs.existsSync(encountersDir)) {
      fs.mkdirSync(encountersDir, { recursive: true });
    }
    
    const fileName = encountername.endsWith('.json') ? encountername : `${encountername}.json`;
    const filePath = path.join(encountersDir, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(encounterData, null, 2));
    
    // Broadcast encounter data change
    const eventEncounterName = fileName.replace(/\.json$/, '');
    publish(`encounter-data-${campaign}-${eventEncounterName}`, encounterData);
    
    res.json({ message: 'Encounter updated successfully' });
  } catch (error) {
    console.error('Error saving encounter:', error);
    res.status(500).json({ error: 'Failed to save encounter' });
  }
});

// DELETE /api/campaigns/:campaign/encounters/:encountername - Delete an encounter
app.delete('/api/campaigns/:campaign/encounters/:encountername', (req, res) => {
  const { campaign, encountername } = req.params;
  const encountersDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'encounters');
  const fileName = encountername.endsWith('.json') ? encountername : `${encountername}.json`;
  const filePath = path.join(encountersDir, fileName);
  
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Encounter not found' });
    }
    
    fs.unlinkSync(filePath);
    
    // Broadcast encounters list change
    const encounterKey = fileName.replace(/\.json$/, '');
    publish(`encounters-list-${campaign}`, { action: 'deleted', encounter: encounterKey });
    
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
  
  const encountersDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'encounters');
  const oldFileName = encountername.endsWith('.json') ? encountername : `${encountername}.json`;
  const oldFilePath = path.join(encountersDir, oldFileName);
  const newFileName = sanitizeEncounterName(newName.trim());
  const newFilePath = path.join(encountersDir, newFileName);
  
  try {
    if (!fs.existsSync(oldFilePath)) {
      return res.status(404).json({ error: 'Encounter not found' });
    }
    
    if (fs.existsSync(newFilePath) && oldFileName !== newFileName) {
      return res.status(400).json({ error: 'An encounter with this name already exists' });
    }
    
    // Read existing data and update name
    const encounterData = JSON.parse(fs.readFileSync(oldFilePath, 'utf-8'));
    encounterData.name = newName.trim();
    
    // Write with new name, delete old file
    fs.writeFileSync(newFilePath, JSON.stringify(encounterData, null, 2));
    
    if (oldFileName !== newFileName) {
      fs.unlinkSync(oldFilePath);
    }
    
    // Broadcast encounters list change
    publish(`encounters-list-${campaign}`, { 
      action: 'renamed', 
      oldName: oldFileName.replace(/\.json$/, ''), 
      newName: newFileName.replace(/\.json$/, '') 
    });
    
    res.json({ 
      message: 'Encounter renamed successfully', 
      encounter: { name: newName.trim(), fileName: newFileName }
    });
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
    fs.readFile('characterChangeData.json', 'utf-8', (err, data) => {
        if (err) {
            console.error('Failed to read character file');
        } else {
            characterChangeData = JSON.parse(data.toString());
        }
    });
}
const saveFile = () => {
    const data = JSON.stringify(characterChangeData);
    fs.writeFile('characterChangeData.json', data, (err) => {
        if (err) {
            console.error('Failed to save character change data');
        }
    });
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
                deleteCharacterImage(originalImagePath);
                character.imagePath = '';
            } else if (character.image && character.imageName) {
                processImageUpload(character, originalImagePath);
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
                processImageUpload(character, originalImagePath);
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

        // Also delete maps-meta.json if it exists
        const metaFile = path.join(campaignDir, 'maps', 'maps-meta.json');
        if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile);

        // Remove all files in the campaign directory
        files.forEach(file => {
            if (file !== 'maps') {
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
        processImageUpload(character);
        
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
    const key = `positioning-${campaign}`;
    const storedData = characterChangeData[key];
    if (storedData) {
        res.status(200).json(storedData);
    } else {
        res.status(200).json({ creatures: [] });
    }
});

// API endpoint to save positioning data for a campaign
app.post('/api/campaigns/:campaign/positioning', (req, res) => {
    const { campaign } = req.params;
    const positioningData = req.body;
    const key = `positioning-${campaign}`;
    characterChangeData[key] = positioningData;
    res.status(200).json({ message: 'Positioning data stored successfully' });
    if (!saveTimer) {
        saveTimer = setTimeout(() => {
            saveFile();
            clearTimeout(saveTimer);
            saveTimer = null;
        }, persistDataDebounceMilliseconds);
    }
    publish(key, positioningData);
});

// Wildcard routes for character data (must be AFTER /api/campaigns)
app.get('/api/:key', (req, res) => {
    const { key } = req.params;
    const storedData = characterChangeData[key];
    if (storedData) {
        res.status(200).json(storedData);
    } else {
        res.status(404).json({ error: 'Data not found' });
    }
});
app.post('/api/:key', (req, res) => {
    const { key } = req.params;
    const data = req.body?.value ?? req.body;
    characterChangeData[key] = data;
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

let characterChangeData = {}
let subscribers = [];
readFile(); // Read once at startup
let saveTimer = null;

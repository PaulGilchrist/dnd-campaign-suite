// API for saving character changes like Gold, Hit Points, Initiative Order, Inspiration, Classes, Barbarian Rage Points, Bard Inpiration Uses, Cleric Channel Divinity Charges, Fighter Action Surges, Fighter Indomitable Uses, Monk Ki Points, Sorcerer Sorcery Points, Wizard Arcane Recovery Levels, Spell Slots, Spells Prepared
// Changes are cached in memory, and batch persisted to disk (backed up) at a configurable interval
import express from 'express';
import os from 'os';
import path from 'path';
import { readFile, keepAlive } from './server/utils/changeData.js';
import sseRoutes from './server/routes/sse.js';
import mapsRoutes from './server/routes/maps.js';
import encountersRoutes from './server/routes/encounters.js';
import notesRoutes from './server/routes/notes.js';
import npcsRoutes from './server/routes/npcs.js';
import questsRoutes from './server/routes/quests.js';
import factionsRoutes from './server/routes/factions.js';
import campaignsBasic from './server/routes/campaigns-basic.js';
import campaignsCharacter from './server/routes/campaigns-character.js';
import campaignsChangedata from './server/routes/campaigns-changedata.js';
import campaignsAdmin from './server/routes/campaigns-admin.js';
import logRoutes from './server/routes/log.js';

const PORT = process.env.PORT || 80;

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

// SSE endpoint, health check, and React Router fallback
app.use(sseRoutes);

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

    // Load character change data from disk at startup
    readFile();

    // Start keep-alive health check
    keepAlive();
});

// Serve static files from the public directory
app.use(express.static(path.join(process.cwd(), 'public'), {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store');
    }
}));

// ====== API ROUTES (mounted in original order) ======

// Map routes (must be before wildcard :campaign route)
app.use(mapsRoutes);

// Encounter routes
app.use(encountersRoutes);

// Notes routes
app.use(notesRoutes);

// NPC routes
app.use(npcsRoutes);

// Quest routes
app.use(questsRoutes);

// Faction routes
app.use(factionsRoutes);

// Campaign basic routes (list campaigns, list character files)
app.use(campaignsBasic);

// Character routes (GET/PUT/DELETE /:file, POST /character)
app.use(campaignsCharacter);

// Change data routes (after character file route so .json files aren't captured by :key)
app.use(campaignsChangedata);

// Campaign admin routes (create, rename, delete campaign)
app.use(campaignsAdmin);

// Campaign log routes (must be before wildcard catch-all in sseRoutes)
app.use(logRoutes);

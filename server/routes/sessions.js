import fs from 'fs';
import { campaignDataFile, ensureDataDir } from '../utils/campaignPaths.js';
import asyncHandler from '../utils/asyncHandler.js';
import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';

const baseRouter = createJsonEntityRouter('sessions', {
  idField: 'name',
  pluralDisplayName: 'sessions',
  singularDisplayName: 'session',
});

// PUT /api/campaigns/:campaign/sessions/:sessionName — upsert by name
baseRouter.put('/api/campaigns/:campaign/sessions/:sessionName', asyncHandler((req, res) => {
  try {
    const { campaign, sessionName } = req.params;
    const decodedName = decodeURIComponent(sessionName);
    const updatedSession = req.body;
    const filePath = campaignDataFile(campaign, 'sessions.json');

    ensureDataDir(campaign);

    let sessions = [];
    if (fs.existsSync(filePath)) {
      sessions = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    if (!Array.isArray(sessions)) sessions = [];

    const newName = (updatedSession.name || '').trim();
    if (!newName) {
      return res.status(400).json({ error: 'Session name is required' });
    }
    const nameCollision = sessions.find(s =>
      s.name !== decodedName && (s.name || '').toLowerCase() === newName.toLowerCase()
    );
    if (nameCollision) {
      return res.status(400).json({ error: 'A session with that name already exists' });
    }

    const existingIndex = sessions.findIndex(s => s.name === decodedName);

    if (existingIndex !== -1) {
      sessions[existingIndex] = updatedSession;
    } else {
      sessions.push(updatedSession);
    }

    fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2));
    res.json({ success: true, session: updatedSession });
  } catch (error) {
    console.error('Error updating session:', error);
    throw new Error('Failed to update session');
  }
}));

export default baseRouter;

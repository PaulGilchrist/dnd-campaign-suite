import fs from 'fs';
import { campaignDataFile, ensureDataDir } from '../utils/campaignPaths.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  createJsonEntityRouter,
  conflictErrorBody,
  hasUpdateConflict,
  stampForSave,
} from '../utils/jsonEntityCrud.js';
import { findDuplicateNameError } from '../utils/nameUniqueness.js';

const baseRouter = createJsonEntityRouter('sessions', {
  idField: 'name',
  pluralDisplayName: 'sessions',
  singularDisplayName: 'session',
  validateList: (sessions) => findDuplicateNameError(sessions, 'session'),
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

    // Concurrent-save guard (mirrors jsonEntityCrud POST): stale echoed stamp
    // = this tab never read the current row — refuse instead of clobbering.
    const existingSession = existingIndex !== -1 ? sessions[existingIndex] : null;
    if (hasUpdateConflict(existingSession, updatedSession)) {
      return res.status(409).json(conflictErrorBody('session', decodedName));
    }

    const stampedSession = stampForSave(updatedSession, existingSession);
    if (existingIndex !== -1) {
      sessions[existingIndex] = stampedSession;
    } else {
      sessions.push(stampedSession);
    }

    fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2));
    res.json({ success: true, session: stampedSession });
  } catch (error) {
    console.error('Error updating session:', error);
    throw new Error('Failed to update session');
  }
}));

export default baseRouter;

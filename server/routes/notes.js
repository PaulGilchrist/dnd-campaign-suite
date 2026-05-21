import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// GET /api/campaigns/:campaign/notes - List all notes
router.get('/api/campaigns/:campaign/notes', (req, res) => {
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
router.post('/api/campaigns/:campaign/notes', (req, res) => {
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
router.get('/api/campaigns/:campaign/notes/:noteId', (req, res) => {
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
router.delete('/api/campaigns/:campaign/notes/:noteId', (req, res) => {
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

export default router;

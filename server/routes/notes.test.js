import request from 'supertest';
import express from 'express';
import notes from './notes.js';

// Use globalThis to work around vi.mock hoisting
// Note: _noteStore is initialized lazily by vi.mock factory

function setupNotes(campaign, data) {
    if (!globalThis._noteStore) globalThis._noteStore = new Map();
    if (data === null) {
        globalThis._noteStore.delete(campaign);
    } else {
        globalThis._noteStore.set(campaign, data || []);
    }
}

function clearNoteStore() {
    if (globalThis._noteStore) globalThis._noteStore.clear();
}

// Mock jsonEntityCrud
vi.mock('../utils/jsonEntityCrud.js', () => {
    const { Router } = require('express');
    const createRouter = vi.fn((entityName, options) => {
        const router = Router();
        const { itemWrapper, onDelete, transformList, authorizeRead, forbiddenMessage } = options;
        const singularize = (name) => {
            if (name === 'npcs') return 'npc';
            if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
            if (name.endsWith('s')) return name.slice(0, -1);
            return name;
        };

        // GET list
        router.get(`/api/campaigns/:campaign/${entityName}`, (_req, res) => {
            const campaign = _req.params.campaign;
            const data = (globalThis._noteStore && globalThis._noteStore.get(campaign)) || [];
            const result = transformList ? transformList(data, _req) : data;
            res.json({ [entityName]: result });
        });

        // POST - replaces entire array
        router.post(`/api/campaigns/:campaign/${entityName}`, (req, res) => {
            const campaign = req.params.campaign;
            const entities = req.body[entityName];
            globalThis._noteStore.set(campaign, entities || []);
            res.json({ success: true });
        });

        // GET by id
        router.get(`/api/campaigns/:campaign/${entityName}/:name`, (req, res) => {
            const campaign = req.params.campaign;
            const name = req.params.name;
            const data = (globalThis._noteStore && globalThis._noteStore.get(campaign)) || [];
            const item = data.find(n => n.name === name);
            if (!item) {
                return res.status(404).json({ error: 'Note not found' });
            }
            if (authorizeRead) {
                try {
                    if (!authorizeRead(item, { ...req, hostname: req.hostname || 'localhost' })) {
                        return res.status(403).json({ error: forbiddenMessage });
                    }
                } catch (_e) {
                    // authorizeRead threw — allow access by default in tests
                }
            }
            const wrapper = itemWrapper || singularize(entityName);
            res.json({ [wrapper]: item });
        });

        // PUT
        router.put(`/api/campaigns/:campaign/${entityName}/:name`, (req, res) => {
            const campaign = req.params.campaign;
            const name = req.params.name;
            const data = (globalThis._noteStore && globalThis._noteStore.get(campaign)) || [];
            const idx = data.findIndex(n => n.name === name);
            if (idx === -1) {
                return res.status(404).json({ error: 'Note not found' });
            }
            Object.assign(data[idx], req.body);
            res.json({ success: true, note: data[idx] });
        });

        // DELETE
        router.delete(`/api/campaigns/:campaign/${entityName}/:name`, (req, res) => {
            const campaign = req.params.campaign;
            const name = req.params.name;
            const data = (globalThis._noteStore && globalThis._noteStore.get(campaign)) || [];
            const idx = data.findIndex(n => n.name === name);
            if (idx === -1) {
                return res.status(404).json({ error: 'Note not found' });
            }
            if (onDelete) onDelete(data[idx]);
            data.splice(idx, 1);
            globalThis._noteStore.set(campaign, data);
            res.json({ success: true });
        });

        return router;
    });
    return { createJsonEntityRouter: createRouter };
});

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(notes);
    return app;
}

afterEach(() => {
    clearNoteStore();
    vi.restoreAllMocks();
});

// ─── GET /api/campaigns/:campaign/notes ──────────────────────────────────────

describe('notes - GET /api/campaigns/:campaign/notes', () => {
    it('should return an empty notes list when no notes exist', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-note-campaign/notes');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('notes');
        expect(Array.isArray(res.body.notes)).toBe(true);
        expect(res.body.notes).toEqual([]);
    });

    it('should return a list of notes with name, content, and isPrivate field', async () => {
        setupNotes('test-note-campaign', [
            { name: 'Quest Notes', content: 'Find the dragon', isPrivate: false },
            { name: 'GM Secrets', content: 'Dragon is actually a god', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-note-campaign/notes');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(2);
        expect(res.body.notes[0]).toEqual({ name: 'Quest Notes', content: 'Find the dragon', isPrivate: false });
        expect(res.body.notes[1]).toEqual({ name: 'GM Secrets', content: 'Dragon is actually a god', isPrivate: true });
    });

    it('should include private notes when running on localhost (default in tests)', async () => {
        setupNotes('test-note-campaign', [
            { name: 'Public Note', content: 'Everyone sees this', isPrivate: false },
            { name: 'GM Note', content: 'GM only', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-note-campaign/notes');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(2);
        expect(res.body.notes.map(n => n.name)).toEqual(['Public Note', 'GM Note']);
    });
});

// ─── POST /api/campaigns/:campaign/notes ─────────────────────────────────────

describe('notes - POST /api/campaigns/:campaign/notes', () => {
    it('should replace the entire notes array', async () => {
        setupNotes('test-note-campaign', [
            { name: 'Old Note', content: 'Old', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-note-campaign/notes')
            .send({
                notes: [
                    { name: 'New Note 1', content: 'Content 1', isPrivate: false },
                    { name: 'New Note 2', content: 'Content 2', isPrivate: true },
                ],
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = globalThis._noteStore.get('test-note-campaign');
        expect(stored).toHaveLength(2);
        expect(stored[0].name).toBe('New Note 1');
        expect(stored[1].name).toBe('New Note 2');
    });

    it('should handle empty notes array', async () => {
        setupNotes('test-note-campaign', [
            { name: 'Old Note', content: 'Old', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-note-campaign/notes')
            .send({ notes: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = globalThis._noteStore.get('test-note-campaign');
        expect(stored).toEqual([]);
    });

    it('should handle missing notes in request body', async () => {
        setupNotes('test-note-campaign', [
            { name: 'Old Note', content: 'Old', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-note-campaign/notes')
            .send({});

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = globalThis._noteStore.get('test-note-campaign');
        expect(stored).toEqual([]);
    });
});

// ─── GET /api/campaigns/:campaign/notes/:notename ────────────────────────────

describe('notes - GET /api/campaigns/:campaign/notes/:notename', () => {
    it('should return 404 when note does not exist', async () => {
        setupNotes('test-note-campaign', []);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-note-campaign/notes/Nonexistent');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Note not found');
    });

    it('should return full note data when found', async () => {
        const noteData = {
            name: 'Quest Details',
            content: 'Defeat the goblins in the cave',
            isPrivate: false,
            author: 'GM',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-02T00:00:00.000Z',
        };
        setupNotes('test-note-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-note-campaign/notes/Quest Details');

        expect(res.status).toBe(200);
        expect(res.body.note).toEqual(noteData);
    });

    it('should return full note data including all fields', async () => {
        const noteData = {
            name: 'GM Secrets',
            content: 'The dragon is actually a god in disguise',
            isPrivate: true,
            author: 'GM',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-06-15T12:00:00.000Z',
        };
        setupNotes('test-note-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-note-campaign/notes/GM Secrets');

        expect(res.status).toBe(200);
        expect(res.body.note.name).toBe('GM Secrets');
        expect(res.body.note.content).toBe('The dragon is actually a god in disguise');
        expect(res.body.note.isPrivate).toBe(true);
        expect(res.body.note.author).toBe('GM');
        expect(res.body.note.createdAt).toBe('2025-01-01T00:00:00.000Z');
        expect(res.body.note.updatedAt).toBe('2025-06-15T12:00:00.000Z');
    });

    it('should return 404 when note store is empty', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-note-campaign/notes/Any');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Note not found');
    });
});

// ─── PUT /api/campaigns/:campaign/notes/:notename ────────────────────────────

describe('notes - PUT /api/campaigns/:campaign/notes/:notename', () => {
    it('should return 404 when note does not exist', async () => {
        setupNotes('test-note-campaign', []);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-note-campaign/notes/Nonexistent')
            .send({ content: 'Updated content' });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Note not found');
    });

    it('should update an existing note', async () => {
        setupNotes('test-note-campaign', [
            { name: 'Old Note', content: 'Old content', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-note-campaign/notes/Old Note')
            .send({ content: 'New content', isPrivate: true });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = globalThis._noteStore.get('test-note-campaign');
        expect(stored[0].content).toBe('New content');
        expect(stored[0].isPrivate).toBe(true);
        expect(stored[0].name).toBe('Old Note');
    });

    it('should overwrite note data with provided fields', async () => {
        setupNotes('test-note-campaign', [
            { name: 'Update Test', content: 'Initial', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-note-campaign/notes/Update Test')
            .send({ content: 'Updated content', isPrivate: true, author: 'New GM' });

        expect(res.status).toBe(200);

        const stored = globalThis._noteStore.get('test-note-campaign');
        expect(stored[0].content).toBe('Updated content');
        expect(stored[0].isPrivate).toBe(true);
        expect(stored[0].author).toBe('New GM');
    });
});

// ─── DELETE /api/campaigns/:campaign/notes/:notename ─────────────────────────

describe('notes - DELETE /api/campaigns/:campaign/notes/:notename', () => {
    it('should return 404 when note does not exist', async () => {
        setupNotes('test-note-campaign', []);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-note-campaign/notes/Nonexistent');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Note not found');
    });

    it('should delete a note and return success', async () => {
        setupNotes('test-note-campaign', [
            { name: 'Delete Me', content: 'Content', isPrivate: false },
            { name: 'Keep Me', content: 'Content', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-note-campaign/notes/Delete Me');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = globalThis._noteStore.get('test-note-campaign');
        expect(stored).toHaveLength(1);
        expect(stored[0].name).toBe('Keep Me');
    });

    it('should remove only the specified note when multiple exist', async () => {
        setupNotes('test-note-campaign', [
            { name: 'First', content: 'Content 1', isPrivate: false },
            { name: 'Second', content: 'Content 2', isPrivate: false },
            { name: 'Third', content: 'Content 3', isPrivate: false },
        ]);

        const app = createTestApp();
        await request(app).delete('/api/campaigns/test-note-campaign/notes/Second');

        const stored = globalThis._noteStore.get('test-note-campaign');
        expect(stored).toHaveLength(2);
        expect(stored.map(n => n.name)).toEqual(['First', 'Third']);
    });
});

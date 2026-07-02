import request from 'supertest';
import express from 'express';
import notes from './notes.js';

// Shared mock store keyed by campaign name
const MOCK_STORE = new Map();

function setupNotes(campaign, data) {
    if (data === null) {
        MOCK_STORE.delete(campaign);
    } else {
        MOCK_STORE.set(campaign, data || []);
    }
}

function clearNoteStore() {
    MOCK_STORE.clear();
}

// Mock jsonEntityCrud to match the real implementation exactly
vi.mock('../utils/jsonEntityCrud.js', () => {
    const { Router } = require('express');
    const createRouter = (entityName, options = {}) => {
        const router = Router();
        const {
            itemWrapper,
            onDelete,
            transformList,
            authorizeRead,
            forbiddenMessage,
        } = options;

        const singularize = (name) => {
            if (name === 'npcs') return 'npc';
            if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
            if (name.endsWith('s')) return name.slice(0, -1);
            return name;
        };

        const wrapper = itemWrapper || singularize(entityName);

        // GET list
        router.get(`/api/campaigns/:campaign/${entityName}`, (req, res) => {
            const campaign = req.params.campaign;
            const data = MOCK_STORE.get(campaign) || [];
            const result = transformList ? transformList(data, req) : data;
            res.json({ [entityName]: result });
        });

        // POST - replaces entire array
        router.post(`/api/campaigns/:campaign/${entityName}`, (req, res) => {
            const campaign = req.params.campaign;
            const entities = req.body[entityName];
            MOCK_STORE.set(campaign, entities || []);
            res.json({ success: true });
        });

        // GET by id (uses 'id' field by default)
        router.get(`/api/campaigns/:campaign/${entityName}/:id`, (req, res) => {
            const campaign = req.params.campaign;
            const id = decodeURIComponent(req.params.id);
            const data = MOCK_STORE.get(campaign) || [];
            const item = data.find(n => n.id === id);
            if (!item) {
                return res.status(404).json({ error: 'Note not found' });
            }
            if (authorizeRead && !authorizeRead(item, req)) {
                return res.status(403).json({ error: forbiddenMessage });
            }
            res.json({ [wrapper]: item });
        });

        // DELETE by id
        router.delete(`/api/campaigns/:campaign/${entityName}/:id`, (req, res) => {
            const campaign = req.params.campaign;
            const id = decodeURIComponent(req.params.id);
            const data = MOCK_STORE.get(campaign) || [];
            const idx = data.findIndex(n => n.id === id);
            if (idx === -1) {
                return res.status(404).json({ error: 'Note not found' });
            }
            if (onDelete) onDelete(data[idx]);
            const filtered = data.filter(n => n.id !== id);
            MOCK_STORE.set(campaign, filtered);
            res.json({ success: true });
        });

        return router;
    };
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
        const res = await request(app).get('/api/campaigns/test-campaign/notes');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('notes');
        expect(Array.isArray(res.body.notes)).toBe(true);
        expect(res.body.notes).toEqual([]);
    });

    it('should return all notes when running on localhost', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Public note', isPrivate: false, partyLocation: 'Town' },
            { id: 'note-2', description: 'GM secret', isPrivate: true, partyLocation: 'Dungeon' },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(2);
        expect(res.body.notes.map(n => n.description)).toEqual(['Public note', 'GM secret']);
    });

    it('should return all notes when running on 127.0.0.1', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Note 1', isPrivate: false },
            { id: 'note-2', description: 'Note 2', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', '127.0.0.1');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(2);
    });

    it('should filter out private notes for non-localhost users', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Public note', isPrivate: false },
            { id: 'note-2', description: 'GM secret', isPrivate: true },
            { id: 'note-3', description: 'Another public', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(2);
        expect(res.body.notes.every(n => !n.isPrivate)).toBe(true);
        expect(res.body.notes.map(n => n.description)).toEqual(['Public note', 'Another public']);
    });

    it('should filter out private notes for arbitrary non-localhost hostname', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Public', isPrivate: false },
            { id: 'note-2', description: 'Private', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', 'example.com');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(1);
        expect(res.body.notes[0].description).toBe('Public');
    });

    it('should return notes with all expected fields', async () => {
        const noteData = {
            id: 'note-42',
            description: 'Dragon lair location',
            isPrivate: false,
            partyLocation: 'Skull Creek Cave',
            partyLevel: 5,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-06-15T12:00:00.000Z',
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(1);
        expect(res.body.notes[0]).toEqual(noteData);
    });

    it('should exclude all notes when all are private and user is non-localhost', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Secret 1', isPrivate: true },
            { id: 'note-2', description: 'Secret 2', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', '10.0.0.1');

        expect(res.status).toBe(200);
        expect(res.body.notes).toEqual([]);
    });
});

// ─── POST /api/campaigns/:campaign/notes ─────────────────────────────────────

describe('notes - POST /api/campaigns/:campaign/notes', () => {
    it('should save notes and return success', async () => {
        const notesData = [
            { id: 'note-1', description: 'First note', isPrivate: false },
            { id: 'note-2', description: 'GM secret', isPrivate: true },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/notes')
            .send({ notes: notesData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored).toHaveLength(2);
        expect(stored[0].description).toBe('First note');
        expect(stored[1].isPrivate).toBe(true);
    });

    it('should save an empty array of notes', async () => {
        setupNotes('test-campaign', [
            { id: 'old-1', description: 'Old note', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/notes')
            .send({ notes: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored).toEqual([]);
    });

    it('should overwrite existing notes with the new array', async () => {
        setupNotes('test-campaign', [
            { id: 'old-1', description: 'Old', isPrivate: false },
        ]);

        const newNotes = [
            { id: 'new-1', description: 'New', isPrivate: false },
            { id: 'new-2', description: 'Newer', isPrivate: true },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/notes')
            .send({ notes: newNotes });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored).toHaveLength(2);
        expect(stored[0].id).toBe('new-1');
        expect(stored[1].id).toBe('new-2');
    });

    it('should handle missing notes in request body and save empty array', async () => {
        setupNotes('test-campaign', [
            { id: 'old-1', description: 'Old', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/notes')
            .send({});

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored).toEqual([]);
    });

    it('should save notes with all expected fields', async () => {
        const notesData = [
            {
                id: 'note-1',
                description: 'Dragon encounter',
                isPrivate: false,
                partyLocation: 'Mountain Pass',
                partyLevel: 7,
                dateCreated: '2025-01-01T00:00:00.000Z',
                dateModified: '2025-06-15T12:00:00.000Z',
            },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/notes')
            .send({ notes: notesData });

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored[0].partyLocation).toBe('Mountain Pass');
        expect(stored[0].partyLevel).toBe(7);
    });
});

// ─── GET /api/campaigns/:campaign/notes/:noteId ──────────────────────────────

describe('notes - GET /api/campaigns/:campaign/notes/:noteId', () => {
    it('should return 404 when note does not exist', async () => {
        setupNotes('test-campaign', []);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/nonexistent-id');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Note not found');
    });

    it('should return full note data when found by localhost user', async () => {
        const noteData = {
            id: 'note-42',
            description: 'Dragon lair details',
            isPrivate: false,
            partyLocation: 'Skull Creek Cave',
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note-42')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('note');
        expect(res.body.note).toEqual(noteData);
    });

    it('should return 403 for private note when accessed by non-localhost user', async () => {
        const noteData = {
            id: 'note-secret',
            description: 'GM secret info',
            isPrivate: true,
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note-secret')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error', 'Access denied: private note');
    });

    it('should allow non-localhost users to access public notes by id', async () => {
        const noteData = {
            id: 'note-public',
            description: 'Public note content',
            isPrivate: false,
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note-public')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(200);
        expect(res.body.note.description).toBe('Public note content');
        expect(res.body.note.isPrivate).toBe(false);
    });

    it('should return 403 for private note when accessed by 127.0.0.1 user (allowed)', async () => {
        const noteData = {
            id: 'note-secret',
            description: 'GM secret',
            isPrivate: true,
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note-secret')
            .set('Host', '127.0.0.1');

        expect(res.status).toBe(200);
        expect(res.body.note.description).toBe('GM secret');
    });

    it('should handle UUID-style note ids', async () => {
        const uuid = 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6';
        const noteData = {
            id: uuid,
            description: 'UUID note',
            isPrivate: false,
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get(`/api/campaigns/test-campaign/notes/${uuid}`)
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.note.description).toBe('UUID note');
    });

    it('should handle note ids with special characters via URL encoding', async () => {
        const noteId = 'note/with/slashes';
        const noteData = {
            id: noteId,
            description: 'Special ID note',
            isPrivate: false,
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note%2Fwith%2Fslashes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.note.description).toBe('Special ID note');
    });

    it('should return note wrapped in "note" key', async () => {
        const noteData = {
            id: 'note-1',
            description: 'Test',
            isPrivate: false,
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note-1')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('note');
        expect(res.body).not.toHaveProperty('notes');
    });
});

// ─── DELETE /api/campaigns/:campaign/notes/:noteId ───────────────────────────

describe('notes - DELETE /api/campaigns/:campaign/notes/:noteId', () => {
    it('should return 404 when note does not exist', async () => {
        setupNotes('test-campaign', []);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/notes/nonexistent-id');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Note not found');
    });

    it('should delete a note and return success', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Keep Me', isPrivate: false },
            { id: 'note-2', description: 'Delete Me', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/notes/note-2');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored).toHaveLength(1);
        expect(stored[0].description).toBe('Keep Me');
    });

    it('should remove only the specified note when multiple exist', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'First', isPrivate: false },
            { id: 'note-2', description: 'Second', isPrivate: false },
            { id: 'note-3', description: 'Third', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/notes/note-2');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored).toHaveLength(2);
        expect(stored.map(n => n.description)).toEqual(['First', 'Third']);
    });

    it('should handle deleting the only note', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Only note', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/notes/note-1');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored).toHaveLength(0);
    });

    it('should handle deleting with UUID-style id', async () => {
        const uuid1 = 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6';
        const uuid2 = 'b2c3d4e5-f6a7-b8c9-d0e1-f2a3b4c5d6e7';
        setupNotes('test-campaign', [
            { id: uuid1, description: 'Delete Me', isPrivate: false },
            { id: uuid2, description: 'Keep Me', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete(`/api/campaigns/test-campaign/notes/${uuid1}`);

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored).toHaveLength(1);
        expect(stored[0].id).toBe(uuid2);
    });

    it('should handle deleting with special characters in id', async () => {
        const noteId = 'note/with/slashes';
        setupNotes('test-campaign', [
            { id: noteId, description: 'Delete Me', isPrivate: false },
            { id: 'note/keep/this', description: 'Keep Me', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/notes/note%2Fwith%2Fslashes');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored).toHaveLength(1);
        expect(stored[0].id).toBe('note/keep/this');
    });
});

import { request } from '../test-utils/localhostSupertest.js';
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
vi.mock('../utils/jsonEntityCrud.js', async () => {
    const { Router } = await import('express');
    const createRouter = (entityName, options = {}) => {
        const router = Router();
        const {
            idField,
            responseWrapper,
            itemWrapper,
            transformList,
            authorizeRead,
            forbiddenMessage,
            onDelete,
        } = options;

        const singularize = (name) => {
            if (name === 'npcs') return 'npc';
            if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
            if (name.endsWith('s')) return name.slice(0, -1);
            return name;
        };

        const effectiveIdField = idField || 'id';
        const effectiveResponseWrapper = responseWrapper || entityName;
        const effectiveItemWrapper = itemWrapper || singularize(entityName);

        // GET list
        router.get(`/api/campaigns/:campaign/${entityName}`, (req, res) => {
            const campaign = req.params.campaign;
            const data = MOCK_STORE.get(campaign) || [];
            const entities = Array.isArray(data) ? data : [];
            const result = transformList ? transformList(entities, req) : entities;
            res.json({ [effectiveResponseWrapper]: result });
        });

        // POST - replaces entire array, validates it's an array
        router.post(`/api/campaigns/:campaign/${entityName}`, (req, res) => {
            const campaign = req.params.campaign;
            const entities = req.body[entityName];
            if (!Array.isArray(entities)) {
                return res.status(400).json({ error: `Expected an array for ${entityName}` });
            }
            MOCK_STORE.set(campaign, entities);
            res.json({ success: true });
        });

        // GET by id (uses configured idField, defaults to 'id')
        router.get(`/api/campaigns/:campaign/${entityName}/:id`, (req, res) => {
            const campaign = req.params.campaign;
            const id = decodeURIComponent(req.params.id);
            const data = MOCK_STORE.get(campaign);

            if (data === undefined) {
                return res.status(404).json({ error: `${effectiveItemWrapper} not found` });
            }

            const entities = Array.isArray(data) ? data : [];
            const entity = entities.find(e => e[effectiveIdField] === id);

            if (!entity) {
                return res.status(404).json({ error: `${effectiveItemWrapper} not found` });
            }

            if (authorizeRead && !authorizeRead(entity, req)) {
                return res.status(403).json({ error: forbiddenMessage });
            }

            res.json({ [effectiveItemWrapper]: entity });
        });

        // DELETE by id
        router.delete(`/api/campaigns/:campaign/${entityName}/:id`, (req, res) => {
            const campaign = req.params.campaign;
            const id = decodeURIComponent(req.params.id);
            const data = MOCK_STORE.get(campaign);

            if (data === undefined) {
                return res.status(404).json({ error: `${effectiveItemWrapper} not found` });
            }

            const entities = Array.isArray(data) ? data : [];
            const entity = entities.find(e => e[effectiveIdField] === id);
            if (onDelete && entity) {
                onDelete(entity, campaign);
            }
            const filtered = entities.filter(e => e[effectiveIdField] !== id);
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

    it('should include notes where isPrivate is undefined (treated as not private)', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'No isPrivate field', partyLocation: 'Town' },
            { id: 'note-2', description: 'Explicitly private', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(1);
        expect(res.body.notes[0].description).toBe('No isPrivate field');
    });

    it('should return all notes when isPrivate is falsy (0, null, empty string)', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Zero', isPrivate: 0 },
            { id: 'note-2', description: 'Null', isPrivate: null },
            { id: 'note-3', description: 'Empty string', isPrivate: '' },
            { id: 'note-4', description: 'Explicitly true', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(3);
        expect(res.body.notes.map(n => n.description)).toEqual(['Zero', 'Null', 'Empty string']);
    });

    it('should handle notes with empty arrays for partyLocation', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Empty location', partyLocation: [] },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(1);
        expect(res.body.notes[0].partyLocation).toEqual([]);
    });

    it('should handle campaign names with special characters in list', async () => {
        setupNotes('test-campaign-123', [
            { id: 'note-1', description: 'Test', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign-123/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(1);
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

    it('should return 400 when notes is not an array', async () => {
        setupNotes('test-campaign', [
            { id: 'old-1', description: 'Old', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/notes')
            .send({ notes: 'not an array' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for notes');
    });

    it('should return 400 when notes is null', async () => {
        setupNotes('test-campaign', [
            { id: 'old-1', description: 'Old', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/notes')
            .send({ notes: null });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for notes');
    });

    it('should return 400 when notes is an object instead of array', async () => {
        setupNotes('test-campaign', [
            { id: 'old-1', description: 'Old', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/notes')
            .send({ notes: { id: 'note-1', description: 'Object' } });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for notes');
    });

    it('should return 400 when notes key is missing from request body', async () => {
        setupNotes('test-campaign', [
            { id: 'old-1', description: 'Old', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/notes')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for notes');
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

    it('should save notes with complex nested data', async () => {
        const notesData = [
            {
                id: 'note-1',
                description: 'A very detailed note with lots of information',
                isPrivate: false,
                partyLocation: ['Town', 'Dungeon', 'Forest'],
                partyLevel: 10,
                tags: ['combat', 'roleplay', 'discovery'],
                metadata: {
                    createdBy: 'GM',
                    version: 2,
                    relatedQuests: ['quest-1', 'quest-2'],
                },
            },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/notes')
            .send({ notes: notesData });

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored[0].partyLocation).toEqual(['Town', 'Dungeon', 'Forest']);
        expect(stored[0].tags).toEqual(['combat', 'roleplay', 'discovery']);
        expect(stored[0].metadata.version).toBe(2);
    });

    it('should handle campaign names with special characters', async () => {
        const notesData = [
            { id: 'note-1', description: 'Test', isPrivate: false },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign-123/notes')
            .send({ notes: notesData });

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign-123');
        expect(stored).toHaveLength(1);
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
        expect(res.body).toHaveProperty('error', 'note not found');
    });

    it('should return 404 when campaign data does not exist', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/nonexistent-campaign/notes/any-id');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'note not found');
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

    it('should return 200 for private note when accessed by 127.0.0.1', async () => {
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

    it('should allow non-localhost users to access notes without isPrivate field', async () => {
        const noteData = {
            id: 'note-no-flag',
            description: 'Note without isPrivate field',
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note-no-flag')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(200);
        expect(res.body.note.description).toBe('Note without isPrivate field');
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

    it('should return note with all fields intact', async () => {
        const noteData = {
            id: 'note-full',
            description: 'Full note',
            isPrivate: false,
            partyLocation: 'Town',
            partyLevel: 5,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-06-15T12:00:00.000Z',
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note-full')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.note).toEqual(noteData);
    });

    it('should handle note ids with spaces via URL encoding', async () => {
        const noteId = 'note with spaces';
        const noteData = {
            id: noteId,
            description: 'Spaces in ID',
            isPrivate: false,
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note%20with%20spaces')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.note.description).toBe('Spaces in ID');
    });

    it('should handle note ids with special characters (hyphens, underscores)', async () => {
        const noteId = 'note-with_special.chars';
        const noteData = {
            id: noteId,
            description: 'Special chars in ID',
            isPrivate: false,
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note-with_special.chars')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.note.description).toBe('Special chars in ID');
    });

    it('should return 403 for private note accessed via 192.168.x.x range', async () => {
        const noteData = {
            id: 'note-secret',
            description: 'GM secret',
            isPrivate: true,
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note-secret')
            .set('Host', '192.168.0.1');

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied: private note');
    });

    it('should return 403 for private note accessed via 10.x.x.x range', async () => {
        const noteData = {
            id: 'note-secret',
            description: 'GM secret',
            isPrivate: true,
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note-secret')
            .set('Host', '10.0.0.1');

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied: private note');
    });
});

// ─── DELETE /api/campaigns/:campaign/notes/:noteId ───────────────────────────

describe('notes - DELETE /api/campaigns/:campaign/notes/:noteId', () => {
    it('should return 404 when note does not exist', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Keep Me', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/notes/nonexistent-id');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored).toHaveLength(1);
    });

    it('should return 404 when campaign data does not exist', async () => {
        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/nonexistent-campaign/notes/any-id');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'note not found');
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

    it('should delete private notes too', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Public', isPrivate: false },
            { id: 'note-2', description: 'Private', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/notes/note-2');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored).toHaveLength(1);
        expect(stored[0].description).toBe('Public');
    });

    it('should handle deleting from empty notes list (returns 200 success since file exists)', async () => {
        setupNotes('test-campaign', []);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/notes/nonexistent');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should handle note ids with spaces via URL encoding', async () => {
        const noteId = 'note with spaces';
        setupNotes('test-campaign', [
            { id: noteId, description: 'Delete Me', isPrivate: false },
            { id: 'keep-this', description: 'Keep Me', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/notes/note%20with%20spaces');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored).toHaveLength(1);
        expect(stored[0].id).toBe('keep-this');
    });

    it('should handle campaign names with special characters', async () => {
        setupNotes('test-campaign-123', [
            { id: 'note-1', description: 'Delete Me', isPrivate: false },
            { id: 'note-2', description: 'Keep Me', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign-123/notes/note-1');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign-123');
        expect(stored).toHaveLength(1);
        expect(stored[0].id).toBe('note-2');
    });

    it('should handle deleting notes with complex nested data', async () => {
        const notesData = [
            {
                id: 'note-1',
                description: 'Complex note to delete',
                isPrivate: false,
                partyLocation: ['Town', 'Dungeon'],
                metadata: { version: 2 },
            },
            {
                id: 'note-2',
                description: 'Keep this one',
                isPrivate: false,
            },
        ];
        setupNotes('test-campaign', notesData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/notes/note-1');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign');
        expect(stored).toHaveLength(1);
        expect(stored[0].description).toBe('Keep this one');
    });
});

// ─── localhost detection edge cases ──────────────────────────────────────────

describe('notes - localhost detection edge cases', () => {
    it('should treat localhost as case-insensitive for list', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Public', isPrivate: false },
            { id: 'note-2', description: 'Private', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', 'LOCALHOST');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(1);
    });

    it('should treat 127.0.0.1 as localhost for individual note access', async () => {
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

    it('should treat localhost as localhost for individual note access', async () => {
        const noteData = {
            id: 'note-secret',
            description: 'GM secret',
            isPrivate: true,
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note-secret')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.note.description).toBe('GM secret');
    });

    it('should treat external IPs as non-localhost for list', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Public', isPrivate: false },
            { id: 'note-2', description: 'Private', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', '0.0.0.0');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(1);
        expect(res.body.notes[0].description).toBe('Public');
    });

    it('should treat external IPs as non-localhost for individual note access', async () => {
        const noteData = {
            id: 'note-secret',
            description: 'GM secret',
            isPrivate: true,
        };
        setupNotes('test-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/note-secret')
            .set('Host', '0.0.0.0');

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied: private note');
    });
});

// ─── Response structure validation ───────────────────────────────────────────

describe('notes - response structure validation', () => {
    it('should wrap list response in "notes" key', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Test', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('notes');
        expect(Array.isArray(res.body.notes)).toBe(true);
        expect(res.body).not.toHaveProperty('note');
    });

    it('should wrap single note response in "note" key (singular)', async () => {
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

    it('should return success boolean on POST', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/notes')
            .send({ notes: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(typeof res.body.success).toBe('boolean');
    });

    it('should return success boolean on DELETE', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Test', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/notes/note-1');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(typeof res.body.success).toBe('boolean');
    });
});

// ─── Notes-specific data patterns ────────────────────────────────────────────

describe('notes - data patterns and edge cases', () => {
    it('should handle notes with empty description', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: '', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(1);
        expect(res.body.notes[0].description).toBe('');
    });

    it('should handle notes with very long descriptions', async () => {
        const longDescription = 'A'.repeat(10000);
        setupNotes('test-campaign', [
            { id: 'note-1', description: longDescription, isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.notes[0].description).toBe(longDescription);
    });

    it('should handle notes with unicode characters in description', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Dragon: ドラゴン 🐉', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.notes[0].description).toBe('Dragon: ドラゴン 🐉');
    });

    it('should handle notes with HTML content in description', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: '<p>HTML content</p><b>Bold</b>', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.notes[0].description).toBe('<p>HTML content</p><b>Bold</b>');
    });

    it('should handle notes with JSON-encoded strings in description', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: '{"key": "value", "nested": {"a": 1}}', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.notes[0].description).toBe('{"key": "value", "nested": {"a": 1}}');
    });

    it('should handle multiple notes with same description but different ids', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Same description', isPrivate: false },
            { id: 'note-2', description: 'Same description', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(2);
    });

    it('should handle notes with string numeric ids', async () => {
        setupNotes('test-campaign', [
            { id: '1', description: 'Numeric ID', isPrivate: false },
            { id: '2', description: 'Another numeric', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes/1')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.note.description).toBe('Numeric ID');
    });

    it('should handle notes with boolean isPrivate values explicitly false', async () => {
        setupNotes('test-campaign', [
            { id: 'note-1', description: 'Explicit false', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(1);
        expect(res.body.notes[0].description).toBe('Explicit false');
    });

    it('should handle large number of notes', async () => {
        const notesData = Array.from({ length: 100 }, (_, i) => ({
            id: `note-${i}`,
            description: `Note ${i}`,
            isPrivate: i % 10 === 0,
        }));
        setupNotes('test-campaign', notesData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(100);
    });

    it('should handle notes with mixed isPrivate values in list for non-localhost', async () => {
        const notesData = Array.from({ length: 20 }, (_, i) => ({
            id: `note-${i}`,
            description: `Note ${i}`,
            isPrivate: i % 3 === 0,
        }));
        setupNotes('test-campaign', notesData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(200);
        // 20 notes total, indices 0, 3, 6, 9, 12, 15, 18 are private (7 private)
        // So 13 should be returned
        expect(res.body.notes).toHaveLength(13);
        expect(res.body.notes.every(n => !n.isPrivate)).toBe(true);
    });
});

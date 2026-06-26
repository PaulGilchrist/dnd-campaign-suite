import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import notes from './notes.js';

// Create a test app with the routes
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(notes);
    return app;
}

const testCampaignsDir = path.join(process.cwd(), 'public', 'campaigns');

function createCampaignDir(name) {
    const campaignDir = path.join(testCampaignsDir, name);
    if (!fs.existsSync(campaignDir)) {
        fs.mkdirSync(campaignDir, { recursive: true });
    }
    return campaignDir;
}

function createNotesFile(campaignName, notesData) {
    const dataDir = path.join(testCampaignsDir, campaignName, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, 'notes.json');
    fs.writeFileSync(filePath, JSON.stringify(notesData, null, 2));
}

function readNotesFile(campaignName) {
    const filePath = path.join(testCampaignsDir, campaignName, 'data', 'notes.json');
    if (!fs.existsSync(filePath)) {
        return [];
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function removeCampaignDir(name) {
    const campaignDir = path.join(testCampaignsDir, name);
    if (fs.existsSync(campaignDir)) {
        fs.rmSync(campaignDir, { recursive: true, force: true });
    }
}

describe('notes - GET /api/campaigns/:campaign/notes', () => {
    afterEach(() => {
        removeCampaignDir('test-notes-campaign');
    });

    it('should create the data directory and return empty notes when notes.json does not exist', async () => {
        createCampaignDir('test-notes-campaign');

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('notes');
        expect(Array.isArray(res.body.notes)).toBe(true);
        expect(res.body.notes).toEqual([]);

        // Verify the file was created
        const fileData = readNotesFile('test-notes-campaign');
        expect(fileData).toEqual([]);
    });

    it('should return all notes when file exists and user is localhost', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', [
            { id: 'note-1', title: 'Public Note', content: 'Hello world', isPrivate: false },
            { id: 'note-2', title: 'Private Note', content: 'Secret stuff', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(2);
        expect(res.body.notes[0].id).toBe('note-1');
        expect(res.body.notes[1].id).toBe('note-2');
    });

    it('should filter out private notes for non-localhost users', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', [
            { id: 'note-1', title: 'Public Note', content: 'Hello world', isPrivate: false },
            { id: 'note-2', title: 'Private Note', content: 'Secret stuff', isPrivate: true },
            { id: 'note-3', title: 'Another Public', content: 'More stuff', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(2);
        expect(res.body.notes.every(n => !n.isPrivate)).toBe(true);
    });

    it('should allow localhost to access all notes including private ones', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', [
            { id: 'note-1', title: 'Private Note', content: 'Secret', isPrivate: true },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes')
            .set('Host', '127.0.0.1');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(1);
        expect(res.body.notes[0].isPrivate).toBe(true);
    });

    it('should handle invalid JSON in notes.json gracefully', async () => {
        createCampaignDir('test-notes-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-notes-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'notes.json');
        fs.writeFileSync(filePath, 'not valid json{{{');

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to read notes');
    });

    it('should handle notes.json containing non-array data', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', { not: 'an array' });

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes');

        expect(res.status).toBe(200);
        expect(res.body.notes).toEqual([]);
    });

    it('should return notes with all their fields', async () => {
        createCampaignDir('test-notes-campaign');
        const noteData = {
            id: 'note-42',
            title: 'Quest Notes',
            content: 'Defeat the dragon',
            isPrivate: false,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-02T00:00:00.000Z',
        };
        createNotesFile('test-notes-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.notes[0]).toEqual(noteData);
    });
});

describe('notes - POST /api/campaigns/:campaign/notes', () => {
    afterEach(() => {
        removeCampaignDir('test-notes-campaign');
    });

    it('should save notes and return success', async () => {
        createCampaignDir('test-notes-campaign');

        const notesData = [
            { id: 'note-1', title: 'First Note', content: 'Content one', isPrivate: false },
            { id: 'note-2', title: 'Second Note', content: 'Content two', isPrivate: true },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-notes-campaign/notes')
            .send({ notes: notesData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNotesFile('test-notes-campaign');
        expect(fileData).toEqual(notesData);
    });

    it('should create the data directory if it does not exist', async () => {
        createCampaignDir('test-notes-campaign');
        // Do not create the data directory

        const notesData = [{ id: 'note-1', title: 'Test', content: 'Test', isPrivate: false }];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-notes-campaign/notes')
            .send({ notes: notesData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(fs.existsSync(path.join(testCampaignsDir, 'test-notes-campaign', 'data'))).toBe(true);
    });

    it('should save an empty array of notes', async () => {
        createCampaignDir('test-notes-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-notes-campaign/notes')
            .send({ notes: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNotesFile('test-notes-campaign');
        expect(fileData).toEqual([]);
    });

    it('should overwrite existing notes with the new array', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', [
            { id: 'old-1', title: 'Old Note', content: 'Old content', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-notes-campaign/notes')
            .send({ notes: [{ id: 'new-1', title: 'New Note', content: 'New content', isPrivate: true }] });

        expect(res.status).toBe(200);

        const fileData = readNotesFile('test-notes-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].id).toBe('new-1');
        expect(fileData[0].title).toBe('New Note');
    });

    it('should handle notes with complex content', async () => {
        createCampaignDir('test-notes-campaign');

        const notesData = [
            {
                id: 'note-1',
                title: 'Monster Stats',
                content: 'HP: 50, AC: 15, Attack: +7 to hit, 1d8+3 damage',
                isPrivate: false,
                tags: ['combat', 'monster'],
            },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-notes-campaign/notes')
            .send({ notes: notesData });

        expect(res.status).toBe(200);

        const fileData = readNotesFile('test-notes-campaign');
        expect(fileData[0].content).toBe('HP: 50, AC: 15, Attack: +7 to hit, 1d8+3 damage');
        expect(fileData[0].tags).toEqual(['combat', 'monster']);
    });

    it('should return 500 on filesystem error during write', async () => {
        createCampaignDir('test-notes-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('Disk full');
        });

        const res = await request(app)
            .post('/api/campaigns/test-notes-campaign/notes')
            .send({ notes: [{ id: 'x', title: 'y', content: 'z', isPrivate: false }] });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to save notes');

        spy.mockRestore();
    });

    it('should return 500 on filesystem error during directory creation', async () => {
        createCampaignDir('test-notes-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
            throw new Error('Permission denied');
        });

        const res = await request(app)
            .post('/api/campaigns/test-notes-campaign/notes')
            .send({ notes: [{ id: 'x', title: 'y', content: 'z', isPrivate: false }] });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to save notes');

        spy.mockRestore();
    });
});

describe('notes - GET /api/campaigns/:campaign/notes/:noteId', () => {
    afterEach(() => {
        removeCampaignDir('test-notes-campaign');
    });

    it('should return 404 when notes.json does not exist', async () => {
        createCampaignDir('test-notes-campaign');

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes/note-1');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Note not found');
    });

    it('should return 404 when note with given id does not exist', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', [
            { id: 'note-1', title: 'Note One', content: 'Content', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes/nonexistent');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Note not found');
    });

    it('should return the note when found', async () => {
        createCampaignDir('test-notes-campaign');
        const noteData = {
            id: 'note-42',
            title: 'Quest Notes',
            content: 'Defeat the dragon',
            isPrivate: false,
        };
        createNotesFile('test-notes-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes/note-42');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('note');
        expect(res.body.note).toEqual(noteData);
    });

    it('should return 403 for private notes from non-localhost users', async () => {
        createCampaignDir('test-notes-campaign');
        const noteData = {
            id: 'private-note',
            title: 'Secret',
            content: 'Top secret info',
            isPrivate: true,
        };
        createNotesFile('test-notes-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes/private-note')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied: private note');
    });

    it('should return private notes to localhost users', async () => {
        createCampaignDir('test-notes-campaign');
        const noteData = {
            id: 'private-note',
            title: 'Secret',
            content: 'Top secret info',
            isPrivate: true,
        };
        createNotesFile('test-notes-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes/private-note')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.note).toEqual(noteData);
    });

    it('should return 127.0.0.1 as localhost for private note access', async () => {
        createCampaignDir('test-notes-campaign');
        const noteData = {
            id: 'private-note',
            title: 'Secret',
            content: 'Top secret info',
            isPrivate: true,
        };
        createNotesFile('test-notes-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes/private-note')
            .set('Host', '127.0.0.1');

        expect(res.status).toBe(200);
        expect(res.body.note.isPrivate).toBe(true);
    });

    it('should return public notes to non-localhost users', async () => {
        createCampaignDir('test-notes-campaign');
        const noteData = {
            id: 'public-note',
            title: 'Public Info',
            content: 'Everyone can see this',
            isPrivate: false,
        };
        createNotesFile('test-notes-campaign', [noteData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes/public-note')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(200);
        expect(res.body.note).toEqual(noteData);
    });

    it('should handle notes.json containing non-array data', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', { not: 'an array' });

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes/any-id');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Note not found');
    });

    it('should return 500 on filesystem error', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', []);

        const app = createTestApp();

        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app)
            .get('/api/campaigns/test-notes-campaign/notes/any-id');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to read note');

        existsSpy.mockRestore();
        readSpy.mockRestore();
    });
});

describe('notes - DELETE /api/campaigns/:campaign/notes/:noteId', () => {
    afterEach(() => {
        removeCampaignDir('test-notes-campaign');
    });

    it('should return 404 when notes.json does not exist', async () => {
        createCampaignDir('test-notes-campaign');

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-notes-campaign/notes/note-1');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Note not found');
    });

    it('should return 200 and silently succeed when note with given id does not exist', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', [
            { id: 'note-1', title: 'Note One', content: 'Content', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-notes-campaign/notes/nonexistent');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        // File should be unchanged since no matching note was removed
        const fileData = readNotesFile('test-notes-campaign');
        expect(fileData).toHaveLength(1);
    });

    it('should delete a note and return success', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', [
            { id: 'note-1', title: 'Keep Me', content: 'Content', isPrivate: false },
            { id: 'note-2', title: 'Delete Me', content: 'Content', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-notes-campaign/notes/note-2');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNotesFile('test-notes-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].id).toBe('note-1');
    });

    it('should remove only the specified note when multiple exist', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', [
            { id: 'note-1', title: 'First', content: 'Content', isPrivate: false },
            { id: 'note-2', title: 'Second', content: 'Content', isPrivate: true },
            { id: 'note-3', title: 'Third', content: 'Content', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-notes-campaign/notes/note-2');

        expect(res.status).toBe(200);

        const fileData = readNotesFile('test-notes-campaign');
        expect(fileData).toHaveLength(2);
        expect(fileData.map(n => n.id)).toEqual(['note-1', 'note-3']);
    });

    it('should handle deleting the only note', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', [
            { id: 'note-1', title: 'Only Note', content: 'Content', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-notes-campaign/notes/note-1');

        expect(res.status).toBe(200);

        const fileData = readNotesFile('test-notes-campaign');
        expect(fileData).toEqual([]);
    });

    it('should handle deleting from a single-note list returning empty array', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', [
            { id: 'solo', title: 'Solo Note', content: 'Content', isPrivate: false },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-notes-campaign/notes/solo');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNotesFile('test-notes-campaign');
        expect(Array.isArray(fileData)).toBe(true);
        expect(fileData.length).toBe(0);
    });

    it('should handle notes.json containing non-array data', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', { not: 'an array' });

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-notes-campaign/notes/any-id');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNotesFile('test-notes-campaign');
        expect(fileData).toEqual([]);
    });

    it('should return 500 on filesystem error during write', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', [
            { id: 'note-1', title: 'Note', content: 'Content', isPrivate: false },
        ]);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('Disk full');
        });

        const res = await request(app)
            .delete('/api/campaigns/test-notes-campaign/notes/note-1');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to delete note');

        spy.mockRestore();
    });

    it('should return 500 on filesystem error during read', async () => {
        createCampaignDir('test-notes-campaign');
        createNotesFile('test-notes-campaign', [
            { id: 'note-1', title: 'Note', content: 'Content', isPrivate: false },
        ]);

        const app = createTestApp();

        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app)
            .delete('/api/campaigns/test-notes-campaign/notes/note-1');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to delete note');

        existsSpy.mockRestore();
        readSpy.mockRestore();
    });
});

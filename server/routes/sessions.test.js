import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

// Mock fs before importing sessions — stores parsed arrays keyed by mock path
const mockFsData = new Map();

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn((path) => mockFsData.has(path)),
    readFileSync: vi.fn((path) => {
      if (!mockFsData.has(path)) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      return JSON.stringify(mockFsData.get(path));
    }),
    writeFileSync: vi.fn((path, data) => {
      mockFsData.set(path, JSON.parse(data));
    }),
  },
  existsSync: vi.fn((path) => mockFsData.has(path)),
  readFileSync: vi.fn((path) => {
    if (!mockFsData.has(path)) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return JSON.stringify(mockFsData.get(path));
  }),
  writeFileSync: vi.fn((path, data) => {
    mockFsData.set(path, JSON.parse(data));
  }),
}));

vi.mock('../utils/campaignPaths.js', () => ({
  campaignDataFile: vi.fn((campaign, name) => `/mock/campaigns/${campaign}/data/${name}`),
  ensureDataDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/data`),
}));

vi.mock('../utils/asyncHandler.js', () => ({
  default: (fn) => (req, res, next) => {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  },
}));

import sessions from './sessions.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(sessions);
  return app;
}

const getFilePath = (campaign) => `/mock/campaigns/${campaign}/data/sessions.json`;

afterEach(() => {
  mockFsData.clear();
  vi.restoreAllMocks();
});

describe('sessions CRUD', () => {
  it('GET returns an empty list when the file does not exist', async () => {
    const res = await request(createTestApp()).get('/api/campaigns/c1/sessions');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sessions: [] });
  });

  it('POST persists the whole array', async () => {
    const payload = [{ name: 'Session 1', status: 'planned' }];
    const res = await request(createTestApp())
      .post('/api/campaigns/c1/sessions')
      .send({ sessions: payload });
    expect(res.status).toBe(200);
    expect(mockFsData.get(getFilePath('c1'))).toEqual(payload);
  });

  it('POST rejects a non-array body', async () => {
    const res = await request(createTestApp())
      .post('/api/campaigns/c1/sessions')
      .send({ sessions: 'nope' });
    expect(res.status).toBe(400);
  });

  it('GET returns one session by name', async () => {
    mockFsData.set(getFilePath('c1'), [{ name: 'Session 1', status: 'planned' }]);
    const res = await request(createTestApp()).get('/api/campaigns/c1/sessions/Session 1');
    expect(res.status).toBe(200);
    expect(res.body.session.name).toBe('Session 1');
  });

  it('GET returns 404 for a missing session', async () => {
    mockFsData.set(getFilePath('c1'), []);
    const res = await request(createTestApp()).get('/api/campaigns/c1/sessions/Missing');
    expect(res.status).toBe(404);
  });

  it('DELETE removes a session by name', async () => {
    mockFsData.set(getFilePath('c1'), [{ name: 'Session 1' }, { name: 'Session 2' }]);
    const res = await request(createTestApp()).delete('/api/campaigns/c1/sessions/Session 1');
    expect(res.status).toBe(200);
    expect(mockFsData.get(getFilePath('c1')).map(s => s.name)).toEqual(['Session 2']);
  });
});

describe('sessions PUT upsert', () => {
  it('creates a new session when none exists', async () => {
    const data = { name: 'Session 7: Smugglers Cave', status: 'planned', links: { maps: ['Cave'] } };
    const res = await request(createTestApp())
      .put('/api/campaigns/c1/sessions/Session 7: Smugglers Cave')
      .send(data);
    expect(res.status).toBe(200);
    expect(res.body.session).toEqual(data);
    expect(mockFsData.get(getFilePath('c1'))).toHaveLength(1);
  });

  it('updates an existing session in place', async () => {
    mockFsData.set(getFilePath('c1'), [{ name: 'Session 1', status: 'planned' }]);
    const updated = { name: 'Session 1', status: 'played', playedAt: '2026-10-10' };
    const res = await request(createTestApp())
      .put('/api/campaigns/c1/sessions/Session 1')
      .send(updated);
    expect(res.status).toBe(200);
    expect(mockFsData.get(getFilePath('c1'))).toEqual([updated]);
  });

  it('rejects an empty name', async () => {
    const res = await request(createTestApp())
      .put('/api/campaigns/c1/sessions/Whatever')
      .send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects a case-insensitive rename collision', async () => {
    mockFsData.set(getFilePath('c1'), [{ name: 'Session 1' }, { name: 'Session 2' }]);
    const res = await request(createTestApp())
      .put('/api/campaigns/c1/sessions/Session 1')
      .send({ name: 'session 2' });
    expect(res.status).toBe(400);
  });

  it('allows saving a session under its own name', async () => {
    mockFsData.set(getFilePath('c1'), [{ name: 'Session 1', status: 'planned' }]);
    const res = await request(createTestApp())
      .put('/api/campaigns/c1/sessions/Session 1')
      .send({ name: 'Session 1', status: 'played' });
    expect(res.status).toBe(200);
  });
});

// AI model-discovery route — localhost gate, D3 local-endpoint refusal,
// honest degraded responses (bounded probe, never hangs the admin UI).
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';

vi.mock('../services/ai/providers/localProvider.js', async () => {
    const actual = await vi.importActual('../services/ai/providers/localProvider.js');
    return { ...actual, probe: vi.fn() };
});

import { probe } from '../services/ai/providers/localProvider.js';
import aiModels from './ai-models.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(aiModels);
    return app;
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/ai/models', () => {
    it('returns the endpoint model list for a local URL', async () => {
        probe.mockResolvedValue({ reachable: true, models: ['llama3.1:8b', 'qwen2.5'], dialect: 'ollama' });
        const res = await request(createTestApp())
            .post('/api/ai/models')
            .send({ endpoint: 'http://localhost:11434', provider: 'ollama' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ models: ['llama3.1:8b', 'qwen2.5'], dialect: 'ollama' });
        expect(probe).toHaveBeenCalledWith({ endpoint: 'http://localhost:11434', provider: 'ollama' });
    });

    it('refuses non-local endpoints before probing (D3 contract)', async () => {
        const res = await request(createTestApp())
            .post('/api/ai/models')
            .send({ endpoint: 'https://api.openai.com/v1' });
        expect(res.status).toBe(400);
        expect(probe).not.toHaveBeenCalled();
    });

    it('endpoint down ⇒ 502 with the probe reason, never a silent empty list', async () => {
        probe.mockResolvedValue({ reachable: false, reason: 'HTTP 503' });
        const res = await request(createTestApp())
            .post('/api/ai/models')
            .send({ endpoint: 'http://localhost:8000/v1' });
        expect(res.status).toBe(502);
        expect(res.body.error).toContain('503');
    });

    it('probe throw ⇒ honest 500', async () => {
        probe.mockRejectedValue(new Error('socket exploded'));
        const res = await request(createTestApp())
            .post('/api/ai/models')
            .send({ endpoint: 'http://localhost:8000/v1' });
        expect(res.status).toBe(500);
    });
});

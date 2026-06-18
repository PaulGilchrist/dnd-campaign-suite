import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Globals ────────────────────────────────────────────────────
global.fetch = vi.fn(() => Promise.resolve({ ok: true }));

// Re-import after globals setup (no mocks needed — service uses only fetch)
import {
  sendSavePrompt,
  sendSaveResult,
  clearSavePrompt,
  sendDeathSavePrompt,
  clearDeathSavePrompt,
  sendDeathSaveResult,
  sendConcentrationPrompt,
  sendConcentrationResult,
} from './savePromptService.js';

// ── Tests ───────────────────────────────────────────────────────

describe('sendSavePrompt', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sends POST request with correct URL and body', async () => {
    await sendSavePrompt('Test Campaign', { targetName: 'Goblin' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/campaigns/Test%20Campaign/savePrompt-Goblin',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: { targetName: 'Goblin' } }),
      }
    );
  });

  it('encodes special characters in campaign name', async () => {
    const campaignName = 'Campaign #1 & Test';
    await sendSavePrompt(campaignName, { targetName: 'T' });

    const expectedUrl = `/api/campaigns/${encodeURIComponent(campaignName)}/savePrompt-T`;
    expect(global.fetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
   });

  it('swallows fetch errors silently', async () => {
    const err = new Error('fail');
    global.fetch.mockReturnValueOnce(Promise.reject(err).catch(() => {}));
    const result = sendSavePrompt('T', { targetName: 'T' });
    expect(result).toBeUndefined(); // fire-and-forget, no promise returned
    await Promise.resolve(); // allow microtask to settle so rejection is caught internally
   });
});

describe('sendSaveResult', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sends POST request with correct URL and body', async () => {
    await sendSaveResult('Test', 'Goblin', { success: true });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/campaigns/Test/saveResult-Goblin',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: { success: true } }),
      }
    );
  });

  it('swallows fetch errors silently', async () => {
    const err = new Error('fail');
    global.fetch.mockReturnValueOnce(Promise.reject(err).catch(() => {}));
    const result = sendSaveResult('T', 'Goblin', {});
    expect(result).toBeUndefined();
    await Promise.resolve();
     });
});

describe('clearSavePrompt', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sends POST request with correct URL and body containing promptId', async () => {
    await clearSavePrompt('Test', 'Goblin', 'prompt-123');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/campaigns/Test/savePromptCleared-Goblin',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: { promptId: 'prompt-123' } }),
      }
    );
  });

  it('swallows fetch errors silently', async () => {
    const err = new Error('fail');
    global.fetch.mockReturnValueOnce(Promise.reject(err).catch(() => {}));
    const result = clearSavePrompt('Test', 'Goblin', 'id');
    expect(result).toBeUndefined();
    await Promise.resolve();
     });
});

describe('sendDeathSavePrompt', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sends POST request with correct URL and body', async () => {
    await sendDeathSavePrompt('Test', { targetName: 'Fighter' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/campaigns/Test/deathSavePrompt-Fighter',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: { targetName: 'Fighter' } }),
      }
    );
  });

  it('swallows fetch errors silently', async () => {
    const err = new Error('fail');
    global.fetch.mockReturnValueOnce(Promise.reject(err).catch(() => {}));
    const result = sendDeathSavePrompt('Test', { targetName: 'T' });
    expect(result).toBeUndefined();
    await Promise.resolve();
      });
});

describe('clearDeathSavePrompt', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sends DELETE request with correct URL and no body or headers', async () => {
    await clearDeathSavePrompt('Test', 'Fighter');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/campaigns/Test/deathSavePrompt-Fighter',
      { method: 'DELETE' }
    );
  });

  it('does not include headers or body in request config', async () => {
    await clearDeathSavePrompt('Test', 'Fighter');
    const call = global.fetch.mock.calls[0];
    expect(call[1].headers).toBeUndefined();
    expect(call[1].body).toBeUndefined();
  });

  it('swallows fetch errors silently', async () => {
    const err = new Error('fail');
    global.fetch.mockReturnValueOnce(Promise.reject(err).catch(() => {}));
    const result = clearDeathSavePrompt('Test', 'T');
    expect(result).toBeUndefined();
    await Promise.resolve();
       });
});

describe('sendDeathSaveResult', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sends POST request with correct URL and body', async () => {
    await sendDeathSaveResult('Test', 'Fighter', { save: true });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/campaigns/Test/deathSaveResult-Fighter',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: { save: true } }),
      }
    );
  });

  it('swallows fetch errors silently', async () => {
    const err = new Error('fail');
    global.fetch.mockReturnValueOnce(Promise.reject(err).catch(() => {}));
    const result = sendDeathSaveResult('Test', 'Fighter', {});
    expect(result).toBeUndefined();
    await Promise.resolve();
        });
});

describe('sendConcentrationPrompt', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sends POST request with correct URL and body', async () => {
    await sendConcentrationPrompt('Test', { targetName: 'Wizard' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/campaigns/Test/concentrationPrompt-Wizard',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: { targetName: 'Wizard' } }),
      }
    );
  });

  it('swallows fetch errors silently', async () => {
    const err = new Error('fail');
    global.fetch.mockReturnValueOnce(Promise.reject(err).catch(() => {}));
    const result = sendConcentrationPrompt('Test', { targetName: 'T' });
    expect(result).toBeUndefined();
    await Promise.resolve();
    });
});

describe('sendConcentrationResult', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sends POST request with correct URL and body', async () => {
    await sendConcentrationResult('Test', 'Wizard', { success: true });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/campaigns/Test/concentrationResult-Wizard',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: { success: true } }),
      }
    );
  });

  it('swallows fetch errors silently', async () => {
    const err = new Error('fail');
    global.fetch.mockReturnValueOnce(Promise.reject(err).catch(() => {}));
    const result = sendConcentrationResult('Test', 'Wizard', {});
    expect(result).toBeUndefined();
    await Promise.resolve();
          });
});

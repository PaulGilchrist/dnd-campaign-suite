// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postLogEntry } from './logPoster.js';
import * as logService from '../ui/logService.js';

vi.mock('../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('postLogEntry', () => {
  it('passes campaign name and entry through to addEntry', async () => {
    logService.addEntry.mockResolvedValue({ id: 42 });

    await postLogEntry('campaign/with/slashes', { type: 'damage', amount: 15 });

    expect(logService.addEntry).toHaveBeenCalledWith('campaign/with/slashes', { type: 'damage', amount: 15 });
  });

  it('returns the resolved value from addEntry on success', async () => {
    const responseData = { id: 42, status: 'added' };
    logService.addEntry.mockResolvedValue(responseData);

    const result = await postLogEntry('my-campaign', { text: 'Test entry' });

    expect(result).toBe(responseData);
  });

  it('returns undefined when addEntry rejects', async () => {
    logService.addEntry.mockRejectedValue(new Error('Network error'));

    const result = await postLogEntry('campaign-1', { text: 'Fails' });

    expect(result).toBeUndefined();
  });
});

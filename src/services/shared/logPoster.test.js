// @cleaned-by-ai
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

});

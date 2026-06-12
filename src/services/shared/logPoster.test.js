import { describe, it, expect, vi } from 'vitest';
import { postLogEntry } from './logPoster.js';
import * as logService from '../ui/logService.js';

vi.mock('../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

describe('postLogEntry', () => {
  it('should call addEntry with campaignName and entry', async () => {
    logService.addEntry.mockResolvedValue({ success: true });
    const result = await postLogEntry('my-campaign', { text: 'Test entry' });
    expect(logService.addEntry).toHaveBeenCalledWith('my-campaign', { text: 'Test entry' });
    expect(result).toEqual({ success: true });
  });

  it('should return the resolved value from addEntry on success', async () => {
    const responseData = { id: 42, status: 'added' };
    logService.addEntry.mockResolvedValue(responseData);
    const result = await postLogEntry('campaign-1', { message: 'Hello' });
    expect(result).toBe(responseData);
  });

  it('should swallow errors from addEntry and return undefined', async () => {
    logService.addEntry.mockRejectedValue(new Error('Network error'));
    const result = await postLogEntry('campaign-1', { text: 'Fails' });
    expect(result).toBeUndefined();
  });

  it('should swallow fetch-like rejections silently', async () => {
    logService.addEntry.mockRejectedValue({ message: 'Failed to add log entry' });
    const result = await postLogEntry('test-campaign', { text: 'Error' });
    expect(result).toBeUndefined();
  });

  it('should encode campaign name via addEntry', async () => {
    logService.addEntry.mockResolvedValue({ ok: true });
    await postLogEntry('campaign/with/slashes', { text: 'Path entry' });
    expect(logService.addEntry).toHaveBeenCalledWith('campaign/with/slashes', { text: 'Path entry' });
  });

  it('should handle entry with complex nested data', async () => {
    logService.addEntry.mockResolvedValue({ created: true });
    const entry = {
      timestamp: Date.now(),
      type: 'damage',
      details: { source: 'Fireball', amount: 15, save: 'dex' },
    };
    const result = await postLogEntry('dnd-party', entry);
    expect(logService.addEntry).toHaveBeenCalledWith('dnd-party', entry);
    expect(result).toEqual({ created: true });
  });

  it('should handle entry with empty object', async () => {
    logService.addEntry.mockResolvedValue({});
    const result = await postLogEntry('campaign', {});
    expect(logService.addEntry).toHaveBeenCalledWith('campaign', {});
    expect(result).toEqual({});
  });

  it('should return undefined when addEntry rejects with null', async () => {
    logService.addEntry.mockRejectedValue(null);
    const result = await postLogEntry('campaign', { text: 'null error' });
    expect(result).toBeUndefined();
  });

  it('should return undefined when addEntry rejects with undefined', async () => {
    logService.addEntry.mockRejectedValue(undefined);
    const result = await postLogEntry('campaign', { text: 'undefined error' });
    expect(result).toBeUndefined();
  });

  it('should work with string campaign name containing special characters', async () => {
    logService.addEntry.mockResolvedValue({ ok: true });
    await postLogEntry('campaign-2024', { text: 'Essentials' });
    expect(logService.addEntry).toHaveBeenCalledWith('campaign-2024', { text: 'Essentials' });
  });

  it('should not throw even when addEntry throws a non-error value', async () => {
    logService.addEntry.mockRejectedValue('string rejection');
    const result = await postLogEntry('campaign', { text: 'string reject' });
    expect(result).toBeUndefined();
  });

  it('should pass through addEntry resolve value as-is', async () => {
    const value = { entries: [{ id: 1, text: 'A' }, { id: 2, text: 'B' }] };
    logService.addEntry.mockResolvedValue(value);
    const result = await postLogEntry('campaign', { text: 'Batch' });
    expect(result).toBe(value);
  });
});

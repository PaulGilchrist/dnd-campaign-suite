// @maintained-by-ai 2026-11-18
// Canonical home for deleteRuntimeKey eviction-response-lane contract tests
// (useRuntimeState.js). Regression pin for
// bug-cross-tab-evict-404-false-survives-console-error: when a concurrent tab
// wins the evict (documented cross-tab save-prompt rescue residual — a second
// live tab answers a parked save prompt and its write empties the
// pendingSavePrompts/pendingSaveListenerPrompts books server-side), this lane's
// drain-to-evict DELETE honestly 404s (campaigns-changedata.js 404s vanished
// keys). Owner fail-loudly ruling (2026-11-10): that 404 is CONFIRMED absence —
// fully SILENT (no console.error claiming "the shared key survives server-side",
// no toast). Only genuine refusals stay loud: 403 keeps both lanes (console +
// runtime-evict-failed toast event, bug-visitor-oa-resolution-strands-marker-
// double-resolve); other non-OK (5xx) keeps the console claim without a toast.
// Scope split: raw store API in useRuntimeState.core.test.js, setRuntimeObject
// in useRuntimeState.setRuntimeObject.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clearRuntimeState,
  deleteRuntimeKey,
  getAllStoreKeys,
  hasRuntimeValue,
  listeners,
  seedTrackedResources,
} from './useRuntimeState.js';

const CAMPAIGN = 'test-campaign';

function clearAll() {
  const keys = getAllStoreKeys();
  for (const key of keys) {
    clearRuntimeState(key);
  }
  listeners.clear();
}

// The DELETE response handler runs in .then microtasks off the mocked fetch.
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function parkBook(propertyName, value) {
  seedTrackedResources('campaign', { [propertyName]: value });
}

describe('useRuntimeState — deleteRuntimeKey eviction response lane', () => {
  let onEvictFailed;

  beforeEach(() => {
    clearAll();
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 });
    global.fetch.mockClear();
    onEvictFailed = vi.fn();
    window.addEventListener('runtime-evict-failed', onEvictFailed);
  });

  afterEach(() => {
    window.removeEventListener('runtime-evict-failed', onEvictFailed);
    vi.restoreAllMocks();
  });

  it('DELETEs the wildcard change-data route and evicts the mirror synchronously', async () => {
    parkBook('pendingSavePrompts', { p1: { promptId: 'p1', campaignName: CAMPAIGN } });
    deleteRuntimeKey('campaign', 'pendingSavePrompts', CAMPAIGN);
    expect(hasRuntimeValue('campaign', 'pendingSavePrompts')).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(`/api/campaigns/${CAMPAIGN}/pendingSavePrompts`);
    expect(init.method).toBe('DELETE');
    await flush();
  });

  it('sends nothing when the mirror key is absent (has()-guard: idempotent double-sweep, no honest-404 churn)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    deleteRuntimeKey('campaign', 'pendingSavePrompts', CAMPAIGN);
    expect(global.fetch).not.toHaveBeenCalled();
    await flush();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('stays fully SILENT on a race-lost 404 — confirmed absence, not a refusal (the filed false "survives server-side" bug face)', async () => {
    parkBook('pendingSaveListenerPrompts', ['p1']);
    const consoleErrorSpy = vi.spyOn(console, 'error');
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Change-data key not found: pendingSaveListenerPrompts' }),
    });
    deleteRuntimeKey('campaign', 'pendingSaveListenerPrompts', CAMPAIGN);
    await flush();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(onEvictFailed).not.toHaveBeenCalled();
    // The mirror was evicted BEFORE the fetch, so the race-lost 404 strands nothing.
    expect(hasRuntimeValue('campaign', 'pendingSaveListenerPrompts')).toBe(false);
  });

  it('stays silent on 2xx (eviction landed)', async () => {
    parkBook('pendingSavePrompts', { p1: { promptId: 'p1' } });
    const consoleErrorSpy = vi.spyOn(console, 'error');
    global.fetch.mockResolvedValue({ ok: true, status: 200 });
    deleteRuntimeKey('campaign', 'pendingSavePrompts', CAMPAIGN);
    await flush();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(onEvictFailed).not.toHaveBeenCalled();
  });

  it('logs loudly AND broadcasts runtime-evict-failed on a 403 authority refusal (both fail-loudly lanes)', async () => {
    parkBook('pendingSavePrompts', { p1: { promptId: 'p1' } });
    const consoleErrorSpy = vi.spyOn(console, 'error');
    global.fetch.mockResolvedValue({ ok: false, status: 403 });
    deleteRuntimeKey('campaign', 'pendingSavePrompts', CAMPAIGN);
    await flush();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('deleteRuntimeKey: server refused eviction of "pendingSavePrompts" (HTTP 403)'),
      expect.objectContaining({ campaignName: CAMPAIGN })
    );
    expect(onEvictFailed).toHaveBeenCalledTimes(1);
    expect(onEvictFailed.mock.calls[0][0].detail).toEqual({
      key: 'pendingSavePrompts',
      campaignName: CAMPAIGN,
      status: 403,
    });
  });

  it('logs loudly without a toast for other non-OK refusals (5xx — key may genuinely survive)', async () => {
    parkBook('pendingSavePrompts', { p1: { promptId: 'p1' } });
    const consoleErrorSpy = vi.spyOn(console, 'error');
    global.fetch.mockResolvedValue({ ok: false, status: 500 });
    deleteRuntimeKey('campaign', 'pendingSavePrompts', CAMPAIGN);
    await flush();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('deleteRuntimeKey: server refused eviction of "pendingSavePrompts" (HTTP 500)'),
      expect.objectContaining({ campaignName: CAMPAIGN })
    );
    expect(onEvictFailed).not.toHaveBeenCalled();
  });

  it('logs the missing-campaignName guard error and sends no DELETE', async () => {
    parkBook('pendingSavePrompts', { p1: { promptId: 'p1' } });
    const consoleErrorSpy = vi.spyOn(console, 'error');
    deleteRuntimeKey('campaign', 'pendingSavePrompts', undefined);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'deleteRuntimeKey called with undefined campaignName',
      expect.objectContaining({ characterKey: 'campaign', propertyName: 'pendingSavePrompts' })
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(hasRuntimeValue('campaign', 'pendingSavePrompts')).toBe(false);
    await flush();
  });
});

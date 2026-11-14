// @maintained-by-ai
// clearDeathSavePrompt mirror gate (backlog 2026-11-14 death-save-prompt-evict-404-noise):
// after a transient HP-0 that never armed a prompt (external full-store POST,
// sheet-editor drop), the recovery clear-leg used to DELETE a key that was
// never created — the wildcard route's honest 404 (campaigns-changedata.js,
// 2026-10-30-AO doctrine) surfaced as console noise. The gate reads the
// synced runtime-store mirror, which materializes the key on exactly two
// lanes: the campaign-select seed ('campaign' store) and the live
// change-echo bucket (character-style store named after the full key).
// Absent on BOTH ⇒ zero fetch; present on EITHER ⇒ the DELETE proceeds
// (real evict never skipped). Transport bytes stay owned by
// savePromptService.test.js — this file pins the gate only.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  sendDeathSavePrompt,
  clearDeathSavePrompt,
} from './savePromptService.js';
import {
  getStore,
  setRuntimeObject,
  clearRuntimeState,
} from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
const TARGET = 'MirrorGatePaladin';
const KEY = `deathSavePrompt-${TARGET}`;

const clearFetchCalls = () =>
  globalThis.fetch.mock.calls.filter(([, init]) => init?.method === 'DELETE');

describe('clearDeathSavePrompt — mirror-existence gate', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    // Both mirror lanes start empty (never-created key).
    getStore('campaign').delete(KEY);
    clearRuntimeState(KEY);
  });

  afterEach(() => {
    getStore('campaign').delete(KEY);
    clearRuntimeState(KEY);
    vi.restoreAllMocks();
  });

  it('issues NO fetch when the key is absent from both mirror lanes (never-created prompt stays un-probed)', () => {
    clearDeathSavePrompt(CAMPAIGN, TARGET);

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('DELETEs the exact key when the campaign-select seed lane holds it', () => {
    getStore('campaign').set(KEY, { promptId: 'seeded', targetName: TARGET });

    clearDeathSavePrompt(CAMPAIGN, TARGET);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe(`/api/campaigns/${CAMPAIGN}/${KEY}`);
    expect(init.method).toBe('DELETE');
  });

  it('DELETEs when the live value-echo lane holds the bucket (change-echo store named after the key)', () => {
    // Mirrors App.jsx applyStoreUpdate: the object echo lands as a
    // character-style bucket replace (memory-only, skipSync).
    setRuntimeObject(KEY, { promptId: 'armed', targetName: TARGET }, CAMPAIGN, true);

    clearDeathSavePrompt(CAMPAIGN, TARGET);

    expect(clearFetchCalls()).toHaveLength(1);
    expect(clearFetchCalls()[0][0]).toBe(`/api/campaigns/${CAMPAIGN}/${KEY}`);
  });

  it('arms through sendDeathSavePrompt ungated, and the evict proceeds once the echo materializes the mirror (real evict never skipped)', async () => {
    const payload = { promptId: 'real-arm', targetName: TARGET };

    clearDeathSavePrompt(CAMPAIGN, TARGET);
    expect(globalThis.fetch).not.toHaveBeenCalled(); // nothing to evict yet

    sendDeathSavePrompt(CAMPAIGN, payload); // POST lane stays unconditional
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    const [postUrl, postInit] = globalThis.fetch.mock.calls[0];
    expect(postUrl).toBe(`/api/campaigns/${CAMPAIGN}/${KEY}`);
    expect(postInit.method).toBe('POST');

    // The POST response does NOT mirror it — only the SSE echo/select seed
    // does; adopt the echo exactly like App.jsx applyStoreUpdate would.
    setRuntimeObject(KEY, payload, CAMPAIGN, true);

    clearDeathSavePrompt(CAMPAIGN, TARGET);
    await vi.waitFor(() => expect(clearFetchCalls()).toHaveLength(1));
    expect(clearFetchCalls()[0][0]).toBe(`/api/campaigns/${CAMPAIGN}/${KEY}`);
  });

  it('leaves a stale-positive mirror survivor DELETEing (honest double-sweep 404 face preserved, never a silent miss)', () => {
    // Null-echo lane drops non-campaign-key clears, so an evicted ghost
    // bucket survives in the mirror; the gate then replays today's behavior
    // (DELETE → server's honest 404) instead of guessing at server truth.
    setRuntimeObject(KEY, { promptId: 'gone', targetName: TARGET }, CAMPAIGN, true);

    clearDeathSavePrompt(CAMPAIGN, TARGET);

    expect(clearFetchCalls()).toHaveLength(1);
  });
});

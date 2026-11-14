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
// (real evict never skipped). The response leg then EVICTS both mirror lanes
// on any server-confirmed answer (2xx removed / 404 never there), so the
// double-sweep face — the ghost bucket surviving a real arm+resolve because
// the null-echo lane drops non-campaign-key clears — fires its DELETEs at
// most once per client, never on every later clear-leg. Refused/network-
// failed answers keep the mirror (retry, never a silent miss). Transport
// bytes stay owned by savePromptService.test.js — this file pins the gate
// and the eviction.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  sendDeathSavePrompt,
  clearDeathSavePrompt,
} from './savePromptService.js';
import {
  getAllStoreKeys,
  getStore,
  hasRuntimeValue,
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

  it('evicts the echo-bucket ghost after a confirmed DELETE (real arm+resolve): a later clear-leg sends nothing', async () => {
    // The double-sweep face (backlog LC 2026-11-14): the resolve trio's prompt
    // DELETE succeeds but its null echo is dropped for non-campaign keys, so
    // the ghost bucket used to survive and EVERY later clear-leg (sheet roll
    // press, GM-card revive) re-DELETEd the dead key → one honest 404 each.
    setRuntimeObject(KEY, { promptId: 'armed', targetName: TARGET }, CAMPAIGN, true);

    clearDeathSavePrompt(CAMPAIGN, TARGET); // resolve leg — DELETE proceeds
    expect(clearFetchCalls()).toHaveLength(1);

    await vi.waitFor(() =>
      expect(getAllStoreKeys()).not.toContain(KEY)); // server answered ⇒ ghost evicted

    clearDeathSavePrompt(CAMPAIGN, TARGET); // later leg — mirror-absent gate
    expect(clearFetchCalls()).toHaveLength(1); // still exactly one request
  });

  it('evicts BOTH mirror lanes (campaign-select seed + echo bucket) on a confirmed DELETE', async () => {
    getStore('campaign').set(KEY, { promptId: 'seeded', targetName: TARGET });
    setRuntimeObject(KEY, { promptId: 'seeded', targetName: TARGET }, CAMPAIGN, true);

    clearDeathSavePrompt(CAMPAIGN, TARGET);
    expect(clearFetchCalls()).toHaveLength(1);

    await vi.waitFor(() =>
      expect(hasRuntimeValue('campaign', KEY)).toBe(false));
    expect(getAllStoreKeys()).not.toContain(KEY);
  });

  it('evicts on an honest 404 (cross-tab survivor): the second clear-leg is silent', async () => {
    // A passive tab's ghost never saw the resolve; its first clear-leg probes
    // and the server's honest 404 answers "absent" — evict, no re-probe.
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
    setRuntimeObject(KEY, { promptId: 'gone', targetName: TARGET }, CAMPAIGN, true);

    clearDeathSavePrompt(CAMPAIGN, TARGET);
    expect(clearFetchCalls()).toHaveLength(1);

    await vi.waitFor(() =>
      expect(getAllStoreKeys()).not.toContain(KEY));

    clearDeathSavePrompt(CAMPAIGN, TARGET);
    expect(clearFetchCalls()).toHaveLength(1);
  });

  it('keeps the mirror on a refused eviction (403) — a real evict is never silently skipped', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 403 });
    setRuntimeObject(KEY, { promptId: 'pending', targetName: TARGET }, CAMPAIGN, true);

    clearDeathSavePrompt(CAMPAIGN, TARGET);
    await Promise.resolve();
    await Promise.resolve(); // let the (non-evicting) response leg settle

    expect(getAllStoreKeys()).toContain(KEY);
    clearDeathSavePrompt(CAMPAIGN, TARGET); // retried until the server confirms
    expect(clearFetchCalls()).toHaveLength(2);
  });

  it('keeps the mirror when the DELETE never reaches the server (network rejection)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetch.mockRejectedValueOnce(new Error('offline'));
    setRuntimeObject(KEY, { promptId: 'pending', targetName: TARGET }, CAMPAIGN, true);

    clearDeathSavePrompt(CAMPAIGN, TARGET);
    await vi.waitFor(() => expect(errSpy).toHaveBeenCalled());

    expect(getAllStoreKeys()).toContain(KEY); // retryable, not guessed absent
  });
});

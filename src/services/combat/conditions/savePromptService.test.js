// @maintained-by-ai
// savePromptService lane: this file owns the transport bytes produced by the
// service itself — exact POST/DELETE URLs (campaign encodeURIComponent'd,
// '<family>-<targetName>' keys), exact { value } JSON envelopes, DELETEs with
// no body/headers, fire-and-forget non-propagation, and the post-POST
// CustomEvent envelopes (flesh-to-stone / prismatic indigo / violet).
// Consumers (CreatureCard, SavePromptModal*, useLoggedDiceRollSaves,
// automation savePrompt.js) all mock this module, so they verify CALL-ARGS
// only (e.g. createRollConditionSaveHandler #1004 pins call-args through a
// mock; buildConditionPopup envelope is @#1004). Endpoint bytes are here.
// Turn-based canon: the source uses no timers — adjudication prompts wait
// indefinitely and are removed only by explicit clear* calls; the exception-
// shaped lane is the result keys' self-sweep (save 2026-11-03 + concentration
// 2026-10-29-Z + death-save backlog death-save-result-key-never-deleted),
// DELETEd event-driven on their own POST response (no timer).
// Verified.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getStore } from '../../../hooks/runtime/useRuntimeState.js';
import {
  sendSavePrompt,
  sendSaveResult,
  clearSavePrompt,
  clearSaveResult,
  sendDeathSavePrompt,
  clearDeathSavePrompt,
  sendDeathSaveResult,
  clearDeathSaveResult,
  sendConcentrationPrompt,
  sendConcentrationResult,
  clearConcentrationPrompt,
  clearConcentrationResult,
  sendFleshToStonePrompt,
  clearFleshToStonePrompt,
  sendFleshToStoneResult,
  sendPrismaticSprayIndigoResult,
  sendPrismaticSprayVioletResult,
} from './savePromptService.js';

// Campaign name with space/#/& exercised in EVERY row — pins the
// encodeURIComponent output at each URL without a separate encode test.
const CAMPAIGN = 'Campaign #1';
const ENCODED_CAMPAIGN = 'Campaign%20%231';

/** POST families: prompt sends take (campaign, promptData). */
const PROMPT_POSTS = [
  { fn: sendSavePrompt, key: 'savePrompt-Goblin', data: { targetName: 'Goblin', dc: 13 } },
  // Per-promptId key (save-prompt queue orphan fix 2026-11-03): each save
  // gets its own key so a drained queue never DELETEs the same key twice.
  { fn: sendSavePrompt, key: 'savePrompt-Goblin-prompt-abc', data: { targetName: 'Goblin', promptId: 'prompt-abc' } },
  { fn: sendDeathSavePrompt, key: 'deathSavePrompt-Fighter', data: { targetName: 'Fighter' } },
  // Per-promptId key (multi-hit collapse fix): each damage event's prompt
  // lives under its own key so answering one never DELETEs another's.
  { fn: sendConcentrationPrompt, key: 'concentrationPrompt-Wizard-prompt-abc', data: { targetName: 'Wizard', promptId: 'prompt-abc' } },
  { fn: sendFleshToStonePrompt, key: 'fleshToStonePrompt-Goblin', data: { targetName: 'Goblin', dc: 15, casterName: 'Wizard' } },
];

/** POST families: plain results take (campaign, targetName, resultData). */
const RESULT_POSTS = [
  { fn: sendSaveResult, key: 'saveResult-Goblin', result: { success: true } },
  { fn: sendDeathSaveResult, key: 'deathSaveResult-Fighter', result: { success: false } },
  { fn: sendConcentrationResult, key: 'concentrationResult-Wizard', result: { success: true } },
];

/** DELETE families: clears take (campaign, keySuffix/targetName). */
const CLEARS = [
  { fn: clearSavePrompt, key: 'savePrompt-Goblin' },
  { fn: clearSaveResult, key: 'saveResult-Goblin' },
  { fn: clearDeathSavePrompt, key: 'deathSavePrompt-Fighter' },
  { fn: clearConcentrationPrompt, key: 'concentrationPrompt-Wizard' },
  { fn: clearConcentrationResult, key: 'concentrationResult-Goblin' },
  { fn: clearDeathSaveResult, key: 'deathSaveResult-Fighter' },
  { fn: clearFleshToStonePrompt, key: 'fleshToStonePrompt-Goblin' },
];

/** POST families that dispatch a window CustomEvent once the POST resolves. */
const RESULT_EVENTS = [
  { fn: sendFleshToStoneResult, key: 'fleshToStoneResult-Goblin', event: 'flesh-to-stone-result', result: { success: false } },
  { fn: sendPrismaticSprayIndigoResult, key: 'prismaticSprayIndigoResult-Goblin', event: 'prismatic-spray-indigo-result', result: { effect: 'petrified' } },
  { fn: sendPrismaticSprayVioletResult, key: 'prismaticSprayVioletResult-Goblin', event: 'prismatic-spray-violet-result', result: { transported: true } },
];

/** Every exported entry point, for the fire-and-forget sweep. */
const ALL_SENDERS = [
  ...PROMPT_POSTS.map(({ fn, data }) => () => fn(CAMPAIGN, data)),
  ...RESULT_POSTS.map(({ fn, key, result }) => () => fn(CAMPAIGN, key.split('-').slice(1).join('-'), result)),
  ...CLEARS.map(({ fn, key }) => () => fn(CAMPAIGN, key.split('-').slice(1).join('-'))),
  ...RESULT_EVENTS.map(({ fn, key, result }) => () => fn(CAMPAIGN, key.split('-').slice(1).join('-'), result)),
];

describe('savePromptService', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    // clearDeathSavePrompt is mirror-gated (backlog 2026-11-14): seed the
    // prompt key into the campaign mirror so the transport rows below exercise
    // the DELETE as if the prompt lane had materialized the key. The gate's
    // own faces are pinned in savePromptService.death-save-evict-mirror.test.js.
    getStore('campaign').set('deathSavePrompt-Fighter', { promptId: 'seed', targetName: 'Fighter' });
  });

  afterEach(() => {
    getStore('campaign').delete('deathSavePrompt-Fighter');
    vi.restoreAllMocks();
  });

  it.each(PROMPT_POSTS)(
    'posts $key with the exact prompt envelope',
    ({ fn, key, data }) => {
      fn(CAMPAIGN, data);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `/api/campaigns/${ENCODED_CAMPAIGN}/${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: data }),
        }
      );
    }
  );

  it.each(RESULT_POSTS)(
    'posts $key with the exact result envelope',
    ({ fn, key, result }) => {
      const targetName = key.slice(key.indexOf('-') + 1);
      fn(CAMPAIGN, targetName, result);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `/api/campaigns/${ENCODED_CAMPAIGN}/${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: result }),
        }
      );
    }
  );

  it.each(CLEARS)(
    'deletes $key with no body and no headers',
    ({ fn, key }) => {
      fn(CAMPAIGN, key.slice(key.indexOf('-') + 1));

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = globalThis.fetch.mock.calls[0];
      expect(url).toBe(`/api/campaigns/${ENCODED_CAMPAIGN}/${key}`);
      expect(init.method).toBe('DELETE');
      expect(init.body).toBeUndefined();
      expect(init.headers).toBeUndefined();
    }
  );

  it('clears a save prompt by arrival key so a drained queue never re-DELETEs (no 404 orphan call)', () => {
    clearSavePrompt(CAMPAIGN, 'Goblin-prompt-abc');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe(`/api/campaigns/${ENCODED_CAMPAIGN}/savePrompt-Goblin-prompt-abc`);
    expect(init.method).toBe('DELETE');
  });

  describe('save result hygiene lane (backlog 2026-11-03 save-prompt-queue-dismiss-orphan)', () => {
    it('posts the result to its own promptId-scoped key and self-sweeps it after the POST ack', async () => {
      let resolvePost;
      globalThis.fetch.mockImplementationOnce(() => new Promise((res) => { resolvePost = res; }));

      sendSaveResult(CAMPAIGN, 'Goblin', { promptId: 'prompt-abc', success: true });
      await Promise.resolve();
      // No DELETE while the POST is still in flight — the value echo must
      // lead the null echo on every SSE socket (double-roll guard order).
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      resolvePost({ ok: true, json: () => Promise.resolve({}) });
      await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
      const [postUrl] = globalThis.fetch.mock.calls[0];
      expect(postUrl).toBe(`/api/campaigns/${ENCODED_CAMPAIGN}/saveResult-Goblin-prompt-abc`);
      const [url, init] = globalThis.fetch.mock.calls[1];
      expect(url).toBe(`/api/campaigns/${ENCODED_CAMPAIGN}/saveResult-Goblin-prompt-abc`);
      expect(init.method).toBe('DELETE');
    });

    it('falls back to the bare-target key for promptId-less (countercharm/legacy) results', async () => {
      sendSaveResult(CAMPAIGN, 'Goblin', { success: true });
      await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
      const [postUrl] = globalThis.fetch.mock.calls[0];
      expect(postUrl).toBe(`/api/campaigns/${ENCODED_CAMPAIGN}/saveResult-Goblin`);
      const [deleteUrl] = globalThis.fetch.mock.calls[1];
      expect(deleteUrl).toBe(`/api/campaigns/${ENCODED_CAMPAIGN}/saveResult-Goblin`);
    });

    it('never deletes a result key when the POST fails (nothing was written)', async () => {
      globalThis.fetch.mockRejectedValueOnce(new Error('network fail'));

      sendSaveResult(CAMPAIGN, 'Goblin', { promptId: 'prompt-abc', success: true });
      await new Promise((r) => setTimeout(r, 0));
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it('clears a concentration prompt by promptId so sibling multi-hit prompts survive', () => {
    clearConcentrationPrompt(CAMPAIGN, 'Wizard', 'prompt-abc');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe(`/api/campaigns/${ENCODED_CAMPAIGN}/concentrationPrompt-Wizard-prompt-abc`);
    expect(init.method).toBe('DELETE');
  });

  describe('concentration result hygiene lane (backlog 2026-10-29-Z)', () => {
    // POSTs the result then lets the chained DELETE settle.
    const sendAndSettle = async (result) => {
      sendConcentrationResult(CAMPAIGN, 'Wizard', result);
      await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    };

    it('posts the result to its own promptId-scoped key (sibling multi-hit results never collide)', async () => {
      await sendAndSettle({ promptId: 'prompt-abc', success: true });

      const [postUrl, postInit] = globalThis.fetch.mock.calls[0];
      expect(postUrl).toBe(`/api/campaigns/${ENCODED_CAMPAIGN}/concentrationResult-Wizard-prompt-abc`);
      expect(postInit.method).toBe('POST');
    });

    it('falls back to the bare-target key for promptId-less (legacy/staged) results', async () => {
      await sendAndSettle({ success: true });

      const [postUrl] = globalThis.fetch.mock.calls[0];
      expect(postUrl).toBe(`/api/campaigns/${ENCODED_CAMPAIGN}/concentrationResult-Wizard`);
    });

    it('deletes the result key once the POST resolves (echo has reached every connected client)', async () => {
      let resolvePost;
      globalThis.fetch.mockImplementationOnce(() => new Promise((res) => { resolvePost = res; }));

      sendConcentrationResult(CAMPAIGN, 'Wizard', { promptId: 'prompt-abc', success: false });
      await Promise.resolve();
      // No DELETE while the POST is still in flight — the server must publish
      // the value echo before its null-echo can trail it on any SSE socket.
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      resolvePost({ ok: true, json: () => Promise.resolve({}) });
      await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
      const [url, init] = globalThis.fetch.mock.calls[1];
      expect(url).toBe(`/api/campaigns/${ENCODED_CAMPAIGN}/concentrationResult-Wizard-prompt-abc`);
      expect(init.method).toBe('DELETE');
      expect(init.body).toBeUndefined();
      expect(init.headers).toBeUndefined();
    });

    it('never deletes a result key when the POST fails (nothing was written)', async () => {
      globalThis.fetch.mockRejectedValueOnce(new Error('network fail'));

      sendConcentrationResult(CAMPAIGN, 'Wizard', { promptId: 'prompt-abc', success: true });
      await new Promise((r) => setTimeout(r, 0));
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('death-save result hygiene lane (backlog death-save-result-key-never-deleted)', () => {
    // Mirrors the concentration lane above: the target-wide key self-sweeps
    // after its POST ack (no promptId in the death-save key shape).
    it('deletes the result key once the POST resolves (echo has reached every connected client)', async () => {
      let resolvePost;
      globalThis.fetch.mockImplementationOnce(() => new Promise((res) => { resolvePost = res; }));

      sendDeathSaveResult(CAMPAIGN, 'Fighter', { promptId: 'stage-1', success: false });
      await Promise.resolve();
      // No DELETE while the POST is still in flight — the server must publish
      // the value echo before its null-echo can trail it on any SSE socket.
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      resolvePost({ ok: true, json: () => Promise.resolve({}) });
      await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
      const [url, init] = globalThis.fetch.mock.calls[1];
      expect(url).toBe(`/api/campaigns/${ENCODED_CAMPAIGN}/deathSaveResult-Fighter`);
      expect(init.method).toBe('DELETE');
      expect(init.body).toBeUndefined();
      expect(init.headers).toBeUndefined();
    });

    it('never deletes a result key when the POST fails (nothing was written)', async () => {
      globalThis.fetch.mockRejectedValueOnce(new Error('network fail'));

      sendDeathSaveResult(CAMPAIGN, 'Fighter', { promptId: 'stage-1', success: true });
      await new Promise((r) => setTimeout(r, 0));
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it.each(RESULT_EVENTS)(
    'dispatches exactly one $event with the full result envelope after the POST resolves',
    async ({ fn, key, event, result }) => {
      const details = [];
      const handler = (e) => details.push(e.detail);
      window.addEventListener(event, handler);

      const targetName = key.slice(key.indexOf('-') + 1);
      fn(CAMPAIGN, targetName, result);

      await vi.waitFor(() => expect(details).toHaveLength(1));
      expect(details[0]).toEqual({ campaignName: CAMPAIGN, targetName, result });

      window.removeEventListener(event, handler);
    }
  );

  it('never throws to the caller when the network fails (every entry point, fire-and-forget; rejected POSTs skip their chained DELETE)', async () => {
    globalThis.fetch.mockRejectedValue(new Error('network fail'));

    ALL_SENDERS.forEach((call) => expect(call()).toBeUndefined());

    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(ALL_SENDERS.length));
  });
});

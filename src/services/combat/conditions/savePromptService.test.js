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
// indefinitely and are removed only by explicit clear* calls. Verified.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  sendSavePrompt,
  sendSaveResult,
  clearSavePrompt,
  sendDeathSavePrompt,
  clearDeathSavePrompt,
  sendDeathSaveResult,
  sendConcentrationPrompt,
  sendConcentrationResult,
  clearConcentrationPrompt,
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
  { fn: sendDeathSavePrompt, key: 'deathSavePrompt-Fighter', data: { targetName: 'Fighter' } },
  { fn: sendConcentrationPrompt, key: 'concentrationPrompt-Wizard', data: { targetName: 'Wizard' } },
  { fn: sendFleshToStonePrompt, key: 'fleshToStonePrompt-Goblin', data: { targetName: 'Goblin', dc: 15, casterName: 'Wizard' } },
];

/** POST families: plain results take (campaign, targetName, resultData). */
const RESULT_POSTS = [
  { fn: sendSaveResult, key: 'saveResult-Goblin', result: { success: true } },
  { fn: sendDeathSaveResult, key: 'deathSaveResult-Fighter', result: { success: false } },
  { fn: sendConcentrationResult, key: 'concentrationResult-Wizard', result: { success: true } },
];

/** DELETE families: clears take (campaign, targetName). */
const CLEARS = [
  { fn: clearSavePrompt, key: 'savePrompt-Goblin' },
  { fn: clearDeathSavePrompt, key: 'deathSavePrompt-Fighter' },
  { fn: clearConcentrationPrompt, key: 'concentrationPrompt-Wizard' },
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
  });

  afterEach(() => {
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

  it('never throws to the caller when the network fails (all 14 entry points, fire-and-forget)', async () => {
    globalThis.fetch.mockRejectedValue(new Error('network fail'));

    ALL_SENDERS.forEach((call) => expect(call()).toBeUndefined());

    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(ALL_SENDERS.length));
  });
});

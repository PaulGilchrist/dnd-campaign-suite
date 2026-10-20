// @maintained-by-ai
// Lane: INTERNALS of sseObservers.js ONLY — the three factory-built observers' exact
// broadcast tuple bytes through the fetch transport seam. Log-observer internals are
// owned by observers.test.js (#1065 — golden census + bare-fallback + catch-sweep shape
// cited here); pipeline assembly and the campaignName registration gate are pinned by
// index.test.js (#1064) — cited, never re-pinned here.
//
// Transport canon: this module never constructs an EventSource — it POSTs milestones to
// /api/campaigns/:name/pipeline-event and the SERVER re-broadcasts on the ONE shared SSE
// connection (sseClient.js). So global.fetch is mocked at the true external seam only;
// no sseClient.js bypass, no source bug.
//
// Discipline: golden ordered-event census subsumes all membership tests (#985/#1039);
// every broadcast leg pins the FULL fetch tuple incl. exact JSON.stringify bytes (#829/
// #1007); ctx is distinguishable from result to prove it never leaks into payloads
// (#1022); inert + degenerate legs co-located per observer (#945); thrown-transport
// honesty pins each console.error message, not just non-rejection (#1056 + logging
// mandate); no wall-clock — mocked fetch awaited directly (#app); fetch/console
// re-armed in beforeEach, spied console restored in afterEach (#1057/#1007).
//
// old→new map (old 13 tests → new 6):
//   'return an array' + 'wildcard observer' + 'two wildcards' + 'pipeline:resumed'
//     → ONE exact ordered census (test 1)
//   'broadcast event name' + 'broadcast different event names' + 'encode campaign name'
//     → exact-bytes broadcast with key pass-through + URL-encoding legs (test 2),
//     plus strengthened bare-result `data: {}` fallback
//   'skip broadcast when modal is present' → inert modal leg (test 3)
//   'POST modal:shown' + 'NOT POST modal:shown' → exact bytes incl. ctx._pausedStep vs
//     bare-result fallback + co-located inert legs (test 4); brittle idx>0 lookup replaced
//     by census-position destructuring
//   'POST modal:dismissed' → exact bytes + undefined-result fallback (test 5)
//   'handle fetch errors silently' (dishonest title — source logs) → all three catch
//     paths with exact console.error bytes, one call each (test 6)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createSseObservers } from './sseObservers.js';

let consoleError;

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true });
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createSseObservers', () => {
  it('returns exactly three observers in order: wildcard broadcast, modal:shown, modal:dismissed', () => {
    const observers = createSseObservers('test-campaign');

    expect(observers.map(o => o.event)).toEqual(['*', '*', 'pipeline:resumed']);
    observers.forEach(o => expect(typeof o.handler).toBe('function'));
  });

  it('wildcard observer POSTs every event with exact tuple bytes and URL-encoded campaign', async () => {
    const [broadcast] = createSseObservers('test-campaign');
    const ctx = { _pausedStep: 'step-7', playerName: 'Gimli' }; // distinguishable from result — must not leak into payload (#1022)

    await broadcast.handler(ctx, { total: 15 }, 'damage:rolled');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/campaigns/test-campaign/pipeline-event',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'damage:rolled', data: { total: 15 } }),
      }
    );

    // event name flows straight through as key (#829)
    global.fetch.mockClear();
    await broadcast.handler({}, { done: true }, 'spell:applied');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/campaigns/test-campaign/pipeline-event',
      expect.objectContaining({
        body: JSON.stringify({ key: 'spell:applied', data: { done: true } }),
      })
    );

    // bare result falls back to empty object, not undefined bytes (#945)
    global.fetch.mockClear();
    await broadcast.handler({}, undefined, 'step:complete');
    expect(global.fetch.mock.calls[0][1].body).toBe(
      JSON.stringify({ key: 'step:complete', data: {} })
    );

    // campaign name is URL-encoded at the seam
    const [encodedBroadcast] = createSseObservers('my campaign!');
    global.fetch.mockClear();
    await encodedBroadcast.handler({}, { total: 10 }, 'damage:rolled');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/campaigns/my%20campaign!/pipeline-event',
      expect.objectContaining({
        body: JSON.stringify({ key: 'damage:rolled', data: { total: 10 } }),
      })
    );
  });

  it('wildcard observer is inert when result is a modal pause', async () => {
    const [broadcast] = createSseObservers('test-campaign');

    await broadcast.handler({ _pausedStep: 'save-prompt' }, { modal: true }, 'save:prompt');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('modal observer POSTs modal:shown exactly, inert without modal', async () => {
    const [, modalObserver] = createSseObservers('test-campaign');

    // ctx._pausedStep wins over result
    const ctx = { _pausedStep: 'save-prompt' };
    await modalObserver.handler(ctx, { modal: true });
    expect(global.fetch.mock.calls[0][1].body).toBe(
      JSON.stringify({ key: 'modal:shown', data: { step: 'save-prompt' } })
    );

    // bare-result fallback — result itself becomes step, verbatim bytes
    global.fetch.mockClear();
    const result = { modal: true, data: { prompt: 'Cast?' } };
    await modalObserver.handler({}, result);
    expect(global.fetch.mock.calls[0][1].body).toBe(
      JSON.stringify({ key: 'modal:shown', data: { step: result } })
    );

    // inert legs: non-modal and missing result broadcast nothing (#945)
    global.fetch.mockClear();
    await modalObserver.handler({}, { total: 10 });
    await modalObserver.handler({}, undefined);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('resumed observer POSTs modal:dismissed exactly on pipeline:resumed payload', async () => {
    const resumedObserver = createSseObservers('test-campaign')[2];

    await resumedObserver.handler({}, { step: 'test-step' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1].body).toBe(
      JSON.stringify({ key: 'modal:dismissed', data: { step: 'test-step' } })
    );

    // undefined result falls back to empty object (#945)
    global.fetch.mockClear();
    await resumedObserver.handler({}, undefined);
    expect(global.fetch.mock.calls[0][1].body).toBe(
      JSON.stringify({ key: 'modal:dismissed', data: {} })
    );
  });

  it('thrown transport: all three observers catch, log exact console.error, and resolve', async () => {
    const [broadcast, modalObserver, resumedObserver] = createSseObservers('test-campaign');
    const err = new Error('Network error');
    global.fetch.mockRejectedValue(err);

    // live trigger payload per observer so each reaches its own catch
    await expect(broadcast.handler({}, { total: 10 }, 'damage:rolled')).resolves.toBeUndefined();
    await expect(modalObserver.handler({}, { modal: true })).resolves.toBeUndefined();
    await expect(resumedObserver.handler({}, { step: 'x' })).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledTimes(3);
    expect(consoleError.mock.calls.map(call => call[0])).toEqual([
      '[sseObservers] SSE broadcast failed, pipeline continues:',
      '[sseObservers] SSE modal:shown broadcast failed, pipeline continues:',
      '[sseObservers] SSE modal:dismissed broadcast failed, pipeline continues:',
    ]);
    expect(consoleError.mock.calls.every(call => call[1] === err)).toBe(true);
  });
});

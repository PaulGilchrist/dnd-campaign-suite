// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPipeline } from './actionPipeline.js';

/**
 * Pipeline mechanics only (createPipeline contract): event-chain ordering,
 * condition skips, abort-on-null, ctx merge, observer contract, popup side
 * effects, and the modal pause/resume seam. Gate enforcement lives in
 * assertCanAct / gate-sites tests; consumer resume flows live in the
 * useAttackDamageResolution.*Resume tests — not re-pinned here.
 */

describe('createPipeline', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = createPipeline();
  });

  describe('run()', () => {
    it('chains steps by subscribe/emit and executes them in order', async () => {
      const calls = [];
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'b', handler: () => { calls.push('a'); return { data: {} }; } })
        .step({ name: 'b', subscribe: 'b', emit: 'end', handler: () => { calls.push('b'); return { data: {} }; } });

      await pipeline.run('start', {}, { current: null });
      expect(calls).toEqual(['a', 'b']);
    });

    it.each([
      { condition: false, expected: ['a', 'c'], observedEvents: [] },
      { condition: true, expected: ['a', 'b', 'c'], observedEvents: ['b'] },
    ])('runs the handler and notifies its observers when condition is $condition; skips (jumping to its emit) when false', async ({ condition, expected, observedEvents }) => {
      const calls = [];
      const bObserver = vi.fn();
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'b', handler: () => { calls.push('a'); return { data: {} }; } })
        .step({ name: 'conditional', subscribe: 'b', emit: 'c', condition: () => condition, handler: () => { calls.push('b'); return { data: {} }; } })
        .step({ name: 'c', subscribe: 'c', emit: null, handler: () => { calls.push('c'); return { data: {} }; } })
        .observe('b', bObserver);

      await pipeline.run('start', {}, { current: null });
      expect(calls).toEqual(expected);
      expect(bObserver).toHaveBeenCalledTimes(observedEvents.length);
    });

    it('aborts the chain when a handler returns null', async () => {
      const calls = [];
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'b', handler: () => { calls.push('a'); return null; } })
        .step({ name: 'b', subscribe: 'b', emit: null, handler: () => { calls.push('b'); return { data: {} }; } });

      await pipeline.run('start', {}, { current: null });
      expect(calls).toEqual(['a']);
    });

    it.each([
      { result: { data: { added: 2 } }, expected: { existing: 1, added: 2 } },
      { result: {}, expected: { existing: 1 } },
      { result: { data: {} }, expected: { existing: 1 } },
    ])('merges result.data into ctx (and leaves ctx untouched without data): handler returns $result', async ({ result, expected }) => {
      const ctx = { existing: 1 };
      pipeline.step({ name: 'a', subscribe: 'start', emit: null, handler: () => result });

      await pipeline.run('start', ctx, { current: null });
      expect(ctx).toEqual(expected);
    });

    it('pauses at a modal step: writes the full resume envelope over existing resume state and stops before the next step', async () => {
      const resumeRef = { current: { existingProp: 'keep' } };
      const ctx = { attack: { name: 'Test' }, formula: '1d20', total: 10, rolls: [5], modifier: 3, popupHtml: '<p>test</p>' };
      const nextCalls = [];
      pipeline
        .step({
          name: 'modalStep',
          subscribe: 'start',
          emit: 'next',
          handler: () => ({ modal: { type: 'choice', props: { label: 'pick' } }, data: { chosen: 'yes' } }),
        })
        .step({ name: 'afterModal', subscribe: 'next', emit: null, handler: () => { nextCalls.push('afterModal'); return { data: {} }; } });

      await pipeline.run('start', ctx, resumeRef);

      expect(nextCalls).toEqual([]);
      expect(resumeRef.current).toEqual({
        existingProp: 'keep',
        attack: { name: 'Test' },
        formula: '1d20',
        total: 10,
        rolls: [5],
        modifier: 3,
        popupHtml: '<p>test</p>',
        chosen: 'yes',
        _pausedStep: 'modalStep',
        _modalType: 'choice',
        _modalProps: { label: 'pick' },
      });
    });

    it.each([
      { label: 'popup present', result: { popup: '<p>hello</p>', data: {} }, called: true },
      { label: 'popup absent', result: { data: {} }, called: false },
      { label: 'handler returns null', result: null, called: false },
    ])('popup side effect — $label', async ({ result, called }) => {
      const setPopupHtml = vi.fn();
      pipeline.step({ name: 'a', subscribe: 'start', emit: null, handler: () => result });

      await pipeline.run('start', { setPopupHtml }, { current: null });
      if (called) {
        expect(setPopupHtml).toHaveBeenCalledWith('<p>hello</p>');
      } else {
        expect(setPopupHtml).not.toHaveBeenCalled();
      }
    });

    it('notifies every observer matching the event with (ctx, result, eventType) in registration order; other events stay silent', async () => {
      const observer1 = vi.fn();
      const observer2 = vi.fn();
      const otherObserver = vi.fn();
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'done', handler: () => ({ data: { value: 1 } }) })
        .observe('start', observer1)
        .observe('start', observer2)
        .observe('done', otherObserver);

      await pipeline.run('start', { key: 'val' }, { current: null });

      const fullSignature = [expect.objectContaining({ key: 'val', value: 1 }), expect.objectContaining({ data: { value: 1 } }), 'start'];
      expect(observer1).toHaveBeenCalledWith(...fullSignature);
      expect(observer2).toHaveBeenCalledWith(...fullSignature);
      expect(otherObserver).not.toHaveBeenCalled();
    });

    it('notifies wildcard observer (*) once per event, in chain order', async () => {
      const wildcard = vi.fn();
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'b', handler: () => ({ data: { x: 1 } }) })
        .step({ name: 'b', subscribe: 'b', emit: null, handler: () => ({ data: { y: 2 } }) })
        .observe('*', wildcard);

      await pipeline.run('start', {}, { current: null });
      expect(wildcard).toHaveBeenCalledTimes(2);
      expect(wildcard).toHaveBeenNthCalledWith(1, expect.any(Object), expect.objectContaining({ data: { x: 1 } }), 'start');
      expect(wildcard).toHaveBeenNthCalledWith(2, expect.any(Object), expect.objectContaining({ data: { y: 2 } }), 'b');
    });

    it('uses result.nextEvent to reroute the chain, bypassing the step default emit', async () => {
      const calls = [];
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'b', handler: () => ({ data: {}, nextEvent: 'c' }) })
        .step({ name: 'b', subscribe: 'b', emit: null, handler: () => { calls.push('b'); return { data: {} }; } })
        .step({ name: 'c', subscribe: 'c', emit: null, handler: () => { calls.push('c'); return { data: {} }; } });

      await pipeline.run('start', {}, { current: null });
      expect(calls).toEqual(['c']);
    });

    it.each([
      { terminal: null, decoySubscribe: 'null' },
      { terminal: 'unsubscribedEvent', decoySubscribe: null },
    ])('ends the chain when the emitted event is $terminal: no further step runs and resumeRef is cleared', async ({ terminal, decoySubscribe }) => {
      const resumeRef = { current: { _stale: true } };
      const decoyHandler = vi.fn(() => ({ data: {} }));
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: terminal, handler: () => ({ data: {} }) })
        .step({ name: 'decoy', subscribe: decoySubscribe, emit: null, handler: decoyHandler });

      await pipeline.run('start', {}, resumeRef);
      expect(decoyHandler).not.toHaveBeenCalled();
      expect(resumeRef.current).toBeNull();
    });

    it('merges result.data into ctx before notifying observers of that event', async () => {
      const observer = vi.fn();
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: null, handler: () => ({ data: { computed: true } }) })
        .observe('start', observer);

      await pipeline.run('start', {}, { current: null });
      expect(observer).toHaveBeenCalledWith(
        expect.objectContaining({ computed: true }),
        expect.any(Object),
        'start',
      );
    });
  });

  describe('resume()', () => {
    it('resumes from the paused step, continues the remaining chain, and a stray second resume does not re-run it', async () => {
      const calls = [];
      const ctx = { attack: { name: 'Test' } };
      const resumeRef = { current: null };

      pipeline
        .step({ name: 'pauser', subscribe: 'start', emit: 'next', handler: () => ({ modal: { type: 'choice' }, data: {} }) })
        .step({ name: 'resumer', subscribe: 'next', emit: 'tail', handler: () => { calls.push('resumed'); return { data: {} }; } })
        .step({ name: 'tail', subscribe: 'tail', emit: null, handler: () => { calls.push('tail'); return { data: {} }; } });

      await pipeline.run('start', ctx, resumeRef);
      expect(calls).toEqual([]);
      expect(resumeRef.current._pausedStep).toBe('pauser');

      await pipeline.resume(ctx, resumeRef);
      expect(calls).toEqual(['resumed', 'tail']);

      await pipeline.resume(ctx, resumeRef);
      expect(calls).toEqual(['resumed', 'tail']);
      expect(resumeRef.current).toBeNull();
    });

    it.each([
      { label: 'resumeRef is null', current: null },
      { label: '_pausedStep is missing', current: { attack: {} } },
      { label: '_pausedStep names an unknown step', current: { _pausedStep: 'nonexistent' } },
    ])('is a no-op when $label: no step runs and resumeRef is untouched', async ({ current }) => {
      const resumeRef = { current };
      const stepHandler = vi.fn(() => ({ data: {} }));
      pipeline.step({ name: 'first', subscribe: 'start', emit: null, handler: stepHandler });

      await pipeline.resume({}, resumeRef);
      expect(stepHandler).not.toHaveBeenCalled();
      expect(resumeRef.current).toEqual(current);
    });
  });
});

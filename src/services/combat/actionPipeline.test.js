import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPipeline } from './actionPipeline.js';

describe('createPipeline', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = createPipeline();
  });

  describe('step()', () => {
    it('adds a step and returns pipeline for chaining', () => {
      const stepDef = { name: 'a', subscribe: 'start', emit: 'next', handler: vi.fn() };
      const result = pipeline.step(stepDef);
      expect(result).toBe(pipeline);
    });
  });

  describe('observe()', () => {
    it('adds an observer and returns pipeline for chaining', () => {
      const result = pipeline.observe('evt', vi.fn());
      expect(result).toBe(pipeline);
    });

    it('registers multiple observers for the same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      pipeline.observe('start', handler1).observe('start', handler2);
    });
  });

  describe('run()', () => {
    it('executes a chain of steps by subscribe/emit matching', async () => {
      const calls = [];
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'b', handler: () => { calls.push('a'); return { data: {} }; } })
        .step({ name: 'b', subscribe: 'b', emit: 'end', handler: () => { calls.push('b'); return { data: {} }; } });

      await pipeline.run('start', {}, { current: null });
      expect(calls).toEqual(['a', 'b']);
    });

    it('skips a step when condition returns false and jumps to the emitted event', async () => {
      const calls = [];
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'b', handler: () => { calls.push('a'); return { data: {} }; } })
        .step({ name: 'skipMe', subscribe: 'b', emit: 'done', condition: () => false, handler: () => { calls.push('skipMe'); return { data: {} }; } })
        .step({ name: 'c', subscribe: 'done', emit: null, handler: () => { calls.push('c'); return { data: {} }; } });

      await pipeline.run('start', {}, { current: null });
      expect(calls).toEqual(['a', 'c']);
    });

    it('does not skip a step when condition returns true', async () => {
      const calls = [];
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'b', handler: () => { calls.push('a'); return { data: {} }; } })
        .step({ name: 'b', subscribe: 'b', emit: null, condition: () => true, handler: () => { calls.push('b'); return { data: {} }; } });

      await pipeline.run('start', {}, { current: null });
      expect(calls).toEqual(['a', 'b']);
    });

    it('aborts the pipeline when handler returns null', async () => {
      const calls = [];
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'b', handler: () => { calls.push('a'); return null; } })
        .step({ name: 'b', subscribe: 'b', emit: null, handler: () => { calls.push('b'); return { data: {} }; } });

      await pipeline.run('start', {}, { current: null });
      expect(calls).toEqual(['a']);
    });

    it('merges result.data into ctx via Object.assign', async () => {
      const ctx = { existing: 1 };
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: null, handler: () => ({ data: { added: 2 } }) });

      await pipeline.run('start', ctx, { current: null });
      expect(ctx).toEqual({ existing: 1, added: 2 });
    });

    it('does not mutate ctx when result has no data', async () => {
      const ctx = { existing: 1 };
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: null, handler: () => ({ data: {} }) });

      await pipeline.run('start', ctx, { current: null });
      expect(ctx).toEqual({ existing: 1 });
    });

    it('does not mutate ctx when result.data is absent', async () => {
      const ctx = { existing: 1 };
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: null, handler: () => ({}) });

      await pipeline.run('start', ctx, { current: null });
      expect(ctx).toEqual({ existing: 1 });
    });

    it('returns undefined when the pipeline completes normally', async () => {
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: null, handler: () => ({ data: {} }) });

      const result = await pipeline.run('start', {}, { current: null });
      expect(result).toBeUndefined();
    });

    it('pauses and sets resumeRef when result has modal', async () => {
      const resumeRef = { current: null };
      pipeline
        .step({
          name: 'modalStep',
          subscribe: 'start',
          emit: 'next',
          handler: () => ({ modal: { type: 'choice', props: { label: 'pick' } }, data: { chosen: 'yes' } }),
        });

      await pipeline.run('start', { attack: { name: 'Test' }, formula: '1d20', total: 10, rolls: [5], modifier: 3, popupHtml: '<p>test</p>' }, resumeRef);

      expect(resumeRef.current).toEqual({
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

    it('preserves existing resumeRef.current properties when adding modal state', async () => {
      const resumeRef = { current: { existingProp: 'keep' } };
      pipeline
        .step({
          name: 'modalStep',
          subscribe: 'start',
          emit: 'next',
          handler: () => ({ modal: { type: 'text' }, data: {} }),
        });

      await pipeline.run('start', {}, resumeRef);

      expect(resumeRef.current.existingProp).toBe('keep');
      expect(resumeRef.current._pausedStep).toBe('modalStep');
    });

    it('calls ctx.setPopupHtml when result has popup', async () => {
      const setPopupHtml = vi.fn();
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: null, handler: () => ({ popup: '<p>hello</p>', data: {} }) });

      await pipeline.run('start', { setPopupHtml }, { current: null });
      expect(setPopupHtml).toHaveBeenCalledWith('<p>hello</p>');
    });

    it('does not call setPopupHtml when popup is absent', async () => {
      const setPopupHtml = vi.fn();
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: null, handler: () => ({ data: {} }) });

      await pipeline.run('start', { setPopupHtml }, { current: null });
      expect(setPopupHtml).not.toHaveBeenCalled();
    });

    it('does not call setPopupHtml when handler result is absent', async () => {
      const setPopupHtml = vi.fn();
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: null, handler: () => null });

      await pipeline.run('start', { setPopupHtml }, { current: null });
      expect(setPopupHtml).not.toHaveBeenCalled();
    });

    it('notifies matching observers with full signature (ctx, result, eventType)', async () => {
      const observer = vi.fn();
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'done', handler: () => ({ data: { value: 1 } }) })
        .observe('start', observer);

      await pipeline.run('start', { key: 'val' }, { current: null });
      expect(observer).toHaveBeenCalledTimes(1);
      expect(observer).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'val' }),
        expect.objectContaining({ data: { value: 1 } }),
        'start',
      );
    });

    it('notifies wildcard observer (*) on every event', async () => {
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

    it('uses nextEvent to override default emit', async () => {
      const calls = [];
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'b', handler: () => ({ data: {}, nextEvent: 'c' }) })
        .step({ name: 'b', subscribe: 'b', emit: null, handler: () => { calls.push('b'); return { data: {} }; } })
        .step({ name: 'c', subscribe: 'c', emit: null, handler: () => { calls.push('c'); return { data: {} }; } });

      await pipeline.run('start', {}, { current: null });
      expect(calls).toEqual(['c']);
    });

    it('stops when no step subscribes to the emitted event', async () => {
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'noSuchStep', handler: () => ({ data: {} }) });

      await expect(pipeline.run('start', {}, { current: null })).resolves.toBeUndefined();
    });

    it('stops when the emitted event is null', async () => {
      const calls = [];
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: null, handler: () => { calls.push('a'); return { data: {} }; } })
        .step({ name: 'b', subscribe: 'null', emit: null, handler: () => { calls.push('b'); return { data: {} }; } });

      await pipeline.run('start', {}, { current: null });
      expect(calls).toEqual(['a']);
    });

    it('processes data merge before observer notification for the same event', async () => {
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
    it('resumes from the paused step by running from the paused step emit', async () => {
      const calls = [];
      const ctx = { attack: { name: 'Test' } };
      const resumeRef = { current: null };

      pipeline
        .step({ name: 'pauser', subscribe: 'start', emit: 'next', handler: () => ({ modal: { type: 'choice' }, data: {} }) })
        .step({ name: 'resumer', subscribe: 'next', emit: null, handler: () => { calls.push('resumed'); return { data: {} }; } });

      await pipeline.run('start', ctx, resumeRef);
      expect(calls).toEqual([]);

      await pipeline.resume(ctx, resumeRef);
      expect(calls).toEqual(['resumed']);
    });

    it('is a no-op when resumeRef has no paused step', async () => {
      const ctx = {};
      const resumeRef = { current: null };

      await pipeline.resume(ctx, resumeRef);
      expect(resumeRef.current).toBeNull();
    });

    it('is a no-op when paused step name is missing from resumeRef', async () => {
      const ctx = {};
      const resumeRef = { current: { attack: {} } };

      await pipeline.resume(ctx, resumeRef);
    });

    it('is a no-op when the paused step is not found in the pipeline', async () => {
      const ctx = {};
      const resumeRef = { current: { _pausedStep: 'nonexistent' } };

      await pipeline.resume(ctx, resumeRef);
    });

    it('resumes with the correct event (step.emit after the paused step)', async () => {
      const calls = [];
      const ctx = {};
      const resumeRef = { current: null };

      pipeline
        .step({ name: 'first', subscribe: 'start', emit: 'second', handler: () => ({ modal: { type: 'text' }, data: {} }) })
        .step({ name: 'second', subscribe: 'second', emit: 'third', handler: () => { calls.push('second'); return { data: {} }; } })
        .step({ name: 'third', subscribe: 'third', emit: null, handler: () => { calls.push('third'); return { data: {} }; } });

      await pipeline.run('start', ctx, resumeRef);
      expect(calls).toEqual([]);

      await pipeline.resume(ctx, resumeRef);
      expect(calls).toEqual(['second', 'third']);
    });
  });
});

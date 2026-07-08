import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPipeline } from './actionPipeline.js';

describe('createPipeline', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = createPipeline();
  });

  describe('step()', () => {
    it('adds a step and returns pipeline for chaining', () => {
      const result = pipeline.step({ name: 'a', subscribe: 'start', emit: 'next', handler: vi.fn() });
      expect(result).toBe(pipeline);
    });
  });

  describe('observe()', () => {
    it('adds an observer and returns pipeline for chaining', () => {
      const result = pipeline.observe('evt', vi.fn());
      expect(result).toBe(pipeline);
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

    it('skips a step when condition returns false', async () => {
      const calls = [];
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'b', handler: () => { calls.push('a'); return { data: {} }; } })
        .step({ name: 'b', subscribe: 'b', emit: 'done', condition: () => false, handler: () => { calls.push('b'); return { data: {} }; } })
        .step({ name: 'c', subscribe: 'done', emit: null, handler: () => { calls.push('c'); return { data: {} }; } });

      await pipeline.run('start', {}, { current: null });
      expect(calls).toEqual(['a', 'c']);
    });

    it('aborts when handler returns null', async () => {
      const calls = [];
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'b', handler: () => { calls.push('a'); return null; } })
        .step({ name: 'b', subscribe: 'b', emit: null, handler: () => { calls.push('b'); return { data: {} }; } });

      await pipeline.run('start', {}, { current: null });
      expect(calls).toEqual(['a']);
    });

    it('merges result.data into ctx', async () => {
      const ctx = { existing: 1 };
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: null, handler: () => ({ data: { added: 2 } }) });

      await pipeline.run('start', ctx, { current: null });
      expect(ctx).toEqual({ existing: 1, added: 2 });
    });

    it('pauses and sets resumeRef when result has modal', async () => {
      const resumeRef = { current: null };
      const ctx = { attack: { name: 'Test' }, formula: '1d20', total: 10, rolls: [5], modifier: 3, popupHtml: '<p>test</p>' };
      pipeline
        .step({ name: 'modalStep', subscribe: 'start', emit: 'next', handler: () => ({ modal: { type: 'choice' }, data: { chosen: 'yes' } }) });

      await pipeline.run('start', ctx, resumeRef);
      expect(resumeRef.current).toEqual({
        attack: ctx.attack,
        formula: ctx.formula,
        total: ctx.total,
        rolls: ctx.rolls,
        modifier: ctx.modifier,
        popupHtml: ctx.popupHtml,
        chosen: 'yes',
        _pausedStep: 'modalStep',
      });
    });

    it('calls ctx.setPopupHtml when result has popup', async () => {
      const setPopupHtml = vi.fn();
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: null, handler: () => ({ popup: '<p>hello</p>', data: {} }) });

      await pipeline.run('start', { setPopupHtml }, { current: null });
      expect(setPopupHtml).toHaveBeenCalledWith('<p>hello</p>');
    });

    it('notifies matching observers', async () => {
      const observer = vi.fn();
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'done', handler: () => ({ data: { value: 1 } }) })
        .observe('start', observer);

      await pipeline.run('start', {}, { current: null });
      expect(observer).toHaveBeenCalledTimes(1);
      expect(observer).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ data: { value: 1 } }), 'start');
    });

    it('notifies wildcard observer (*) on every event', async () => {
      const wildcard = vi.fn();
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'b', handler: () => ({ data: { x: 1 } }) })
        .step({ name: 'b', subscribe: 'b', emit: null, handler: () => ({ data: { y: 2 } }) })
        .observe('*', wildcard);

      await pipeline.run('start', {}, { current: null });
      expect(wildcard).toHaveBeenCalledTimes(2);
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

    it('stops when no step subscribes to the event type', async () => {
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: 'noSuchStep', handler: () => ({ data: {} }) });

      await expect(pipeline.run('start', {}, { current: null })).resolves.toBeUndefined();
    });

    it('does not call setPopupHtml when popup is absent', async () => {
      const setPopupHtml = vi.fn();
      pipeline
        .step({ name: 'a', subscribe: 'start', emit: null, handler: () => ({ data: {} }) });

      await pipeline.run('start', { setPopupHtml }, { current: null });
      expect(setPopupHtml).not.toHaveBeenCalled();
    });
  });

  describe('resume()', () => {
    it('resumes from the paused step', async () => {
      const calls = [];
      const ctx = { attack: { name: 'Test' } };
      const resumeRef = { current: null };

      pipeline
        .step({ name: 'pauser', subscribe: 'start', emit: 'next', handler: () => ({ modal: true, data: {} }) })
        .step({ name: 'resumer', subscribe: 'next', emit: null, handler: () => { calls.push('resumed'); return { data: {} }; } });

      await pipeline.run('start', ctx, resumeRef);
      expect(calls).toEqual([]);

      await pipeline.resume(ctx, resumeRef);
      expect(calls).toEqual(['resumed']);
    });

    it('is a no-op when no step is paused', async () => {
      const ctx = {};
      const resumeRef = { current: null };

      await pipeline.resume(ctx, resumeRef);
    });

    it('is a no-op when paused step name is missing', async () => {
      const ctx = {};
      const resumeRef = { current: { attack: {} } };

      await pipeline.resume(ctx, resumeRef);
    });
  });
});

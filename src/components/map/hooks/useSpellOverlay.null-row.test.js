// @maintained-by-ai
// LANE: useSpellOverlay null-row fail-soft (bug-overlay-viewer-null-row-crashes-map-view).
// Legacy pre-guard disk docs (public/campaigns/<c>/data/spell-overlays.json) can carry
// null rows. GET /spell-overlay passes them through unfiltered, and the merge lanes
// dereferenced `.id` on them BEFORE SpellOverlayRenderer's isValidOverlay skip could
// fire — a render-phase TypeError that took the whole indoor map view to the
// ErrorBoundary (even the valid sphere never rendered). These tests pin that:
//   · the mount-load merge drops null/undefined rows with a console.error skip log,
//   · the SSE add/update lanes carry the identical guard,
//   · valid + non-null junk rows still merge VERBATIM (the shipped fail-soft design —
//     renderer/Controls own the junk skip; see useSpellOverlay.test.js verbatim pin),
//   · an all-null payload skips the merge entirely (state/equality guard untouched).
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useSpellOverlay from './useSpellOverlay.js';
import { fetchSpellOverlays } from '../../../services/maps/spellOverlayService.js';

// Boundary mock: GET transport is proven at the service owner.
vi.mock('../../../services/maps/spellOverlayService.js', () => ({
  fetchSpellOverlays: vi.fn(),
}));

describe('useSpellOverlay null-row fail-soft', () => {
  const campaignName = 'test-campaign';
  // Canonical createOverlay-shape sphere (valid enough to render).
  const valid = {
    id: 'valid-1',
    shape: 'sphere',
    startGridX: 5,
    startGridY: 5,
    angle: 0,
    radiusFt: 20,
    coneAngle: 0,
    widthFt: 0,
    distanceFt: 0,
    sizeFt: 0,
    color: 'rgba(255,80,60,0.07)',
  };
  const junkObj = { x: 1, y: 2, radius: 3 };
  const junkStr = 'a bare string';
  const coneJunk = { shape: 'cone', startGridX: 5 };

  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    fetchSpellOverlays.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sse = (data) => ({ key: `spell-overlay-${campaignName}`, data });

  it('load-merge survives a disk doc mixing null/undefined with valid and junk rows', async () => {
    fetchSpellOverlays.mockResolvedValue([valid, junkObj, junkStr, null, coneJunk, undefined]);
    const { result } = renderHook(() => useSpellOverlay(campaignName, 'test-map'));
    await act(async () => {});

    // The view lives: nulls are the ONLY dropped class, every other row merges verbatim.
    expect(result.current.overlays).toEqual([valid, junkObj, junkStr, coneJunk]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'useSpellOverlay: skipping 2 null overlay row(s) (load)'
    );
  });

  it('an all-null loaded doc skips the merge entirely (no state write)', async () => {
    fetchSpellOverlays.mockResolvedValue([null, undefined]);
    const { result } = renderHook(() => useSpellOverlay(campaignName, 'test-map'));
    await act(async () => {});

    expect(result.current.overlays).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'useSpellOverlay: skipping 2 null overlay row(s) (load)'
    );
  });

  it('SSE add and update lanes drop null rows without throwing, keeping valid companions', () => {
    const { result } = renderHook(() => useSpellOverlay(campaignName, 'test-map'));

    act(() => {
      result.current.handleSSEEvent(sse({ action: 'add', overlays: [valid, null, junkObj] }));
    });
    expect(result.current.overlays).toEqual([valid, junkObj]);

    const updated = { ...valid, radiusFt: 40 };
    act(() => {
      // The add lane's dedupe kept `valid`; update replaces it while shrugging off nulls.
      result.current.handleSSEEvent(sse({ action: 'update', overlays: [null, updated] }));
    });
    expect(result.current.overlays).toEqual([updated, junkObj]);

    act(() => {
      // An all-null add payload merges nothing (no phantom rows, no throw).
      result.current.handleSSEEvent(sse({ action: 'add', overlays: [null, undefined] }));
    });
    expect(result.current.overlays).toEqual([updated, junkObj]);

    const skipLogs = consoleSpy.mock.calls.filter(c => String(c[0]).startsWith('useSpellOverlay: skipping'));
    expect(skipLogs).toEqual([
      ['useSpellOverlay: skipping 1 null overlay row(s) (SSE)'],
      ['useSpellOverlay: skipping 1 null overlay row(s) (SSE)'],
      ['useSpellOverlay: skipping 2 null overlay row(s) (SSE)'],
    ]);
  });
});

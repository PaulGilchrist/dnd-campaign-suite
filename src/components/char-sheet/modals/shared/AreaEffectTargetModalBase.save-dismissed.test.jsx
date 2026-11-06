// @maintained-by-ai
// AreaEffectTargetModalBase — save-dismissed forwarding (save-dismissed sweep
// family, 2026-11-05). The base registers its save buses only while
// `processing`; the new handleSaveDismissedOverride companion must mirror
// the handleSaveResultOverride contract EXACTLY: same lifetime (arm on
// processing, tear down on unmount), same (event, live-ctx) signature, and
// inert (never even called) without an override so non-opted consumers keep
// byte-identical behavior. Consumer-side drains are pinned per-modal in each
// consumer's own .save-dismissed.test.jsx.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';

vi.mock('./areaEffectModalInstances.js', () => ({
  isApplyBusy: vi.fn(() => false),
  setApplyBusy: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';

const baseProps = {
  combatSummary: { creatures: [{ name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30 }] },
  attackerName: 'Wizard1',
  attackerPos: null,
  saveDc: 14,
  campaignName,
  mapData: null,
  monsters: [],
  featureName: 'Test Effect',
  saveType: 'CHA',
  rangeFeet: 30,
  onClose: vi.fn(),
  characters: [],
  includeCaster: false,
};

let addSpy, removeSpy;

function busCounts(type) {
  return addSpy.mock.calls.filter(([t]) => t === type).length
    - removeSpy.mock.calls.filter(([t]) => t === type).length;
}

function renderBase(props) {
  let ctx = null;
  const renderActions = (c) => {
    ctx = c;
    return (
      <div>
        <button onClick={() => { c.setProcessing(true); c.setPendingPrompts([{ promptId: 'base-dismiss-1', targetName: 'PlayerAlly' }]); }}>Start</button>
      </div>
    );
  };
  const view = render(<AreaEffectTargetModalBase {...baseProps} {...props} renderActions={renderActions} renderBody={() => null} />);
  return { view, getCtx: () => ctx };
}

beforeEach(() => {
  vi.resetAllMocks();
  getRuntimeValue.mockReturnValue([]);
  addSpy = vi.spyOn(window, 'addEventListener');
  removeSpy = vi.spyOn(window, 'removeEventListener');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AreaEffectTargetModalBase — save-dismissed forwarding', () => {
  it('registers save-dismissed only while processing, forwards (event, live ctx), and tears down on unmount', () => {
    const handleSaveDismissedOverride = vi.fn();
    const { view } = renderBase({ handleSaveDismissedOverride });

    // Not processing: no save-dismissed bus registered.
    expect(busCounts('save-dismissed')).toBe(0);
    window.dispatchEvent(new CustomEvent('save-dismissed', { detail: { promptId: 'base-dismiss-1' } }));
    expect(handleSaveDismissedOverride).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(busCounts('save-dismissed')).toBe(1);

    window.dispatchEvent(new CustomEvent('save-dismissed', { detail: { promptId: 'base-dismiss-1', targetName: 'PlayerAlly' } }));
    expect(handleSaveDismissedOverride).toHaveBeenCalledTimes(1);
    const [event, ctx] = handleSaveDismissedOverride.mock.calls[0];
    expect(event.detail.promptId).toBe('base-dismiss-1');
    // LIVE ctx: the consumer sees the current pending list and the real setters.
    expect(ctx.pendingPrompts).toEqual([{ promptId: 'base-dismiss-1', targetName: 'PlayerAlly' }]);
    expect(typeof ctx.setPendingPrompts).toBe('function');
    expect(typeof ctx.setResults).toBe('function');

    // Drain the way a consumer override would, then unmount: bus torn down.
    act(() => {
      ctx.setPendingPrompts(prev => prev.filter(p => p.promptId !== 'base-dismiss-1'));
      ctx.setResults(prev => [...prev, { targetName: 'PlayerAlly', success: true, dismissed: true }]);
    });
    view.unmount();
    expect(busCounts('save-dismissed')).toBe(0);
  });

  it('stays byte-inert without an override: the dismissed broadcast reaches nobody', () => {
    const { view } = renderBase({});
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    // Registered (same lifetime as save-result) but the no-op default swallows.
    expect(busCounts('save-dismissed')).toBe(1);
    expect(() => {
      window.dispatchEvent(new CustomEvent('save-dismissed', { detail: { promptId: 'base-dismiss-1' } }));
    }).not.toThrow();

    view.unmount();
    expect(busCounts('save-dismissed')).toBe(0);
  });
});

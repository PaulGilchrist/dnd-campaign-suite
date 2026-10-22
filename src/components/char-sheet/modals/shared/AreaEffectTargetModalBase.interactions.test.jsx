// @maintained-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';
import { isApplyBusy, setApplyBusy as setApplyBusyInstance } from './areaEffectModalInstances.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('./areaEffectModalInstances.js', () => ({
  isApplyBusy: vi.fn(),
  setApplyBusy: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

const campaignName = 'test-campaign';

const baseCombatSummary = {
  creatures: [
    { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { cha: 0 } },
    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { cha: 2 } },
    { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
  ],
};

const baseProps = {
  combatSummary: baseCombatSummary,
  attackerName: 'Wizard1',
  attackerPos: { gridX: 10, gridY: 10 },
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

beforeEach(() => {
  vi.resetAllMocks();
  getRuntimeValue.mockReturnValue([]);
});

// The base rebuilds its context object on every render, so capture the
// ctx passed to renderActions and assert against the freshest one.
function renderWithButtons(buttons, props = {}) {
  let ctx = null;
  const renderActions = (c) => {
    ctx = c;
    return <div>{buttons.map(({ label, onClick }) => (
      <button key={label} onClick={() => onClick(ctx)}>{label}</button>
    ))}</div>;
  };
  render(<AreaEffectTargetModalBase {...baseProps} {...props} renderActions={renderActions} />);
  return () => ctx;
}

describe('AreaEffectTargetModalBase - Interactions', () => {
  it('Apply click marks the modal busy and delegates to handleApplyOverride with live context', () => {
    isApplyBusy.mockReturnValue(false);
    const handleApplyOverride = vi.fn();
    const getCtx = renderWithButtons([{ label: 'Apply', onClick: (c) => c.handleApply() }], { handleApplyOverride });

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(handleApplyOverride).toHaveBeenCalledTimes(1);
    expect(getCtx()).toEqual(expect.objectContaining({
      saveType: 'CHA',
      saveDc: 14,
      rangeFeet: 30,
      featureName: 'Test Effect',
      attackerName: 'Wizard1',
      campaignName,
      selected: expect.any(Set),
      handleSaveResult: expect.any(Function),
      setProcessing: expect.any(Function),
      setResults: expect.any(Function),
    }));
    // Mount released the busy flag; the click must re-arm it (last call is true).
    expect(setApplyBusyInstance).toHaveBeenLastCalledWith(true);
  });

  it('Apply click is ignored while another apply is busy and is a safe no-op without an override', () => {
    isApplyBusy.mockReturnValue(true);
    renderWithButtons([{ label: 'Apply', onClick: (c) => c.handleApply() }]);
    expect(setApplyBusyInstance).toHaveBeenCalledTimes(1); // mount release only

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(setApplyBusyInstance).toHaveBeenCalledTimes(1); // guard: never marked busy

    // Once free, applying with no override must complete without throwing.
    isApplyBusy.mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(setApplyBusyInstance).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('routes save-result window events to handleSaveResultOverride only while processing, releasing apply-busy when done', () => {
    isApplyBusy.mockReturnValue(false);
    const handleSaveResultOverride = vi.fn();
    renderWithButtons([
      { label: 'Start', onClick: (c) => c.setProcessing(true) },
      { label: 'Stop', onClick: (c) => c.setProcessing(false) },
    ], { handleSaveResultOverride });

    const dispatchSaveResult = () =>
      fireEvent(window, new CustomEvent('save-result', { detail: { success: true } }));

    dispatchSaveResult();
    expect(handleSaveResultOverride).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    dispatchSaveResult();
    expect(handleSaveResultOverride).toHaveBeenCalledTimes(1);
    expect(handleSaveResultOverride).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { success: true } }),
      expect.objectContaining({
        saveType: 'CHA',
        saveDc: 14,
        rangeFeet: 30,
        featureName: 'Test Effect',
        processing: true,
      })
    );
    // Busy flag stays armed while processing (only the mount release so far).
    expect(setApplyBusyInstance).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(setApplyBusyInstance).toHaveBeenCalledTimes(2);
    expect(setApplyBusyInstance).toHaveBeenLastCalledWith(false);

    dispatchSaveResult();
    expect(handleSaveResultOverride).toHaveBeenCalledTimes(1); // listener detached
  });

  it('toggleTarget adds and removes selections and honours the maxTargets cap', () => {
    const getCtx = renderWithButtons([
      { label: 'Toggle Goblin', onClick: (c) => c.toggleTarget('Goblin') },
      { label: 'Toggle Orc', onClick: (c) => c.toggleTarget('Orc') },
    ], { maxTargets: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Goblin' }));
    expect(getCtx().selected).toEqual(new Set(['Goblin']));

    // maxTargets=1: a second selection is refused...
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Orc' }));
    expect(getCtx().selected).toEqual(new Set(['Goblin']));

    // ...while deselecting still works.
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Goblin' }));
    expect(getCtx().selected).toEqual(new Set());
  });

  it('notifies onAllResolved once every selected target has a result', () => {
    const onAllResolved = vi.fn();
    let ctx;
    const renderActions = (c) => {
      ctx = c;
      return null;
    };
    render(<AreaEffectTargetModalBase {...baseProps} renderActions={renderActions} onAllResolved={onAllResolved} />);

    act(() => { ctx.setSelected(new Set(['Goblin'])); });
    expect(onAllResolved).not.toHaveBeenCalled(); // not processing yet

    act(() => { ctx.setProcessing(true); });
    expect(onAllResolved).not.toHaveBeenCalled(); // 0 results < 1 selected

    act(() => { ctx.setResults([{ targetName: 'Goblin', success: true }]); });
    expect(onAllResolved).toHaveBeenCalledTimes(1);
    expect(onAllResolved).toHaveBeenCalledWith(expect.objectContaining({
      results: [{ targetName: 'Goblin', success: true }],
      pendingPrompts: [],
    }));
  });

  it('allResolved consults the overlay-shadowed effective selection (#226 race): setProcessing alone never commits onAllResolved with empty results, and the payload carries the extraState selected set', () => {
    // SaveAttackAoeModal's overlay lane shadows base `selected` with the
    // parent's Set via extraState (spread onto ctx at :214). The base predicate
    // must read that same merged value: with base's own Set left empty,
    // `results.length >= selected.size` was trivially true and allResolved
    // flipped on the setProcessing(true) flush — one microtask before
    // setResults landed — committing an empty results summary.
    const onAllResolved = vi.fn();
    const overlaySelected = new Set(['Goblin', 'Orc']);
    let ctx;
    const renderActions = (c) => {
      ctx = c;
      return null;
    };
    render(
      <AreaEffectTargetModalBase
        {...baseProps}
        renderActions={renderActions}
        onAllResolved={onAllResolved}
        extraState={{ selected: overlaySelected }}
      />
    );

    act(() => { ctx.setProcessing(true); });
    expect(ctx.allResolved).toBe(false); // 0 results < 2 effective-selected
    expect(onAllResolved).not.toHaveBeenCalled();

    act(() => { ctx.setResults([{ targetName: 'Orc', success: false }, { targetName: 'Goblin', success: true }]); });
    expect(ctx.allResolved).toBe(true);
    expect(onAllResolved).toHaveBeenCalledTimes(1);
    expect(onAllResolved).toHaveBeenCalledWith(expect.objectContaining({
      results: [{ targetName: 'Orc', success: false }, { targetName: 'Goblin', success: true }],
      selected: overlaySelected,
      pendingPrompts: [],
      processing: true,
    }));
  });
});

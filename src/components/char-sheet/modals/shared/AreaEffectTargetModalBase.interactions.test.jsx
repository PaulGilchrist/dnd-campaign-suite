import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';
import { isApplyBusy, setApplyBusy as setApplyBusyInstance } from './areaEffectModalInstances.js';

vi.mock('./areaEffectModalInstances.js', () => ({
  isApplyBusy: vi.fn(),
  setApplyBusy: vi.fn(),
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
});

describe('AreaEffectTargetModalBase - Interactions', () => {
  describe('handleApply', () => {
    it('applies when isApplyBusy returns false and passes context to override', async () => {
      isApplyBusy.mockReturnValue(false);

      const handleApplyOverride = vi.fn();
      let capturedCtx = null;
      const renderActions = vi.fn(() => {
        capturedCtx = renderActions.mock.calls[0][0];
        return <button onClick={() => capturedCtx.handleApply()}>Apply</button>;
      });

      render(<AreaEffectTargetModalBase {...baseProps} handleApplyOverride={handleApplyOverride} renderActions={renderActions} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      });

      expect(setApplyBusyInstance).toHaveBeenCalledWith(true);
      expect(handleApplyOverride).toHaveBeenCalledTimes(1);
      expect(handleApplyOverride).toHaveBeenCalledWith(expect.objectContaining({
        saveType: 'CHA',
        saveDc: 14,
        rangeFeet: 30,
        featureName: 'Test Effect',
      }));
    });

    it('uses default no-op when handleApplyOverride is not provided', async () => {
      isApplyBusy.mockReturnValue(false);

      let capturedCtx = null;
      const renderActions = vi.fn(() => {
        capturedCtx = renderActions.mock.calls[0][0];
        return <button onClick={() => capturedCtx.handleApply()}>Apply</button>;
      });

      render(<AreaEffectTargetModalBase {...baseProps} renderActions={renderActions} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      });

      expect(setApplyBusyInstance).toHaveBeenCalledWith(true);
    });

    it('calls handleSaveResultOverride with event and context', () => {
      const handleSaveResultOverride = vi.fn();
      let capturedCtx = null;
      const renderActions = vi.fn(() => {
        capturedCtx = renderActions.mock.calls[0][0];
        return <button onClick={() => capturedCtx.handleSaveResult({ detail: { success: true } })}>Save Result</button>;
      });

      render(<AreaEffectTargetModalBase {...baseProps} handleSaveResultOverride={handleSaveResultOverride} renderActions={renderActions} />);

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Save Result' }));
      });

      expect(handleSaveResultOverride).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { success: true } }),
        expect.objectContaining({
          saveType: 'CHA',
          saveDc: 14,
          rangeFeet: 30,
          featureName: 'Test Effect',
        })
      );
    });
  });
});

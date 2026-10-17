// @maintained-by-ai
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

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
  getRuntimeValue.mockReturnValue([]);
});

describe('AreaEffectTargetModalBase - Rendering & Context', () => {
  it('renders shell, header icon and name, with empty body/actions when no renderers are given', () => {
    const { container } = render(<AreaEffectTargetModalBase {...baseProps} />);

    expect(container.querySelector('.sp-overlay')).toBeInTheDocument();
    const header = container.querySelector('.sp-header');
    expect(header).toHaveTextContent('Test Effect');
    expect(header.querySelector('.fa-dice-d20')).toBeInTheDocument();
    // Children slots are optional — with no renderers they stay empty.
    expect(container.querySelector('.sp-body')).toBeEmptyDOMElement();
    expect(container.querySelector('.sp-actions')).toBeEmptyDOMElement();
  });

  it('replaces the default d20 icon when a custom icon prop is given', () => {
    const { container } = render(<AreaEffectTargetModalBase {...baseProps} icon="fa-solid fa-fire" />);

    expect(container.querySelector('.sp-header .fa-fire')).toBeInTheDocument();
    expect(container.querySelector('.sp-header .fa-dice-d20')).not.toBeInTheDocument();
  });

  it('does not close on overlay or modal content click', () => {
    const onClose = vi.fn();
    const { container } = render(<AreaEffectTargetModalBase {...baseProps} onClose={onClose} />);

    fireEvent.click(container.querySelector('.sp-overlay'));
    fireEvent.click(container.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('invokes renderBody and renderActions with one shared context carrying props, characters, extraState, and live state', () => {
    const characters = [{ name: 'Player1' }, { name: 'Player2' }];
    const renderBody = vi.fn(() => <span>Custom Body</span>);
    const renderActions = vi.fn(() => <span>Custom Actions</span>);
    const { container } = render(
      <AreaEffectTargetModalBase
        {...baseProps}
        characters={characters}
        extraState={{ customField: 'customValue' }}
        renderBody={renderBody}
        renderActions={renderActions}
      />
    );

    expect(renderBody).toHaveBeenCalledTimes(1);
    expect(renderActions).toHaveBeenCalledTimes(1);
    const expectedContext = expect.objectContaining({
      saveType: 'CHA',
      saveDc: 14,
      rangeFeet: 30,
      featureName: 'Test Effect',
      combatSummary: baseCombatSummary,
      attackerName: 'Wizard1',
      campaignName,
      onClose: baseProps.onClose,
      characters,
      customField: 'customValue',
      maxTargets: Infinity,
      selected: expect.any(Set),
      eligibleTargets: expect.any(Array),
      handleApply: expect.any(Function),
      handleSaveResult: expect.any(Function),
      toggleTarget: expect.any(Function),
    });
    expect(renderBody).toHaveBeenCalledWith(expectedContext);
    expect(renderActions).toHaveBeenCalledWith(expectedContext);

    // Output lands in the right slot.
    expect(container.querySelector('.sp-body')).toHaveTextContent('Custom Body');
    expect(container.querySelector('.sp-actions')).toHaveTextContent('Custom Actions');
  });
});

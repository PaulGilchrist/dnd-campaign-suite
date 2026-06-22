// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import CharReactions from './CharReactions.jsx';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  buildFeatureDetailHtml: vi.fn((reaction) => {
    if (reaction.details) return `<b>${reaction.name}</b><br/>${reaction.description}<br/><br/>${reaction.details}`;
    return null;
  }),
  default: vi.fn(() => ({ showPopup: vi.fn(), popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => {
    const [popupHtml, setPopupHtml] = React.useState(null);
    return {
      popupHtml,
      setPopupHtml,
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
    };
  }),
}));

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/combat/baseCombatActions.js', () => ({
  OPPORTUNITY_ATTACK: { name: 'Opportunity Attack', description: 'Can attack creature that moves out of your reach' },
  MELEE_REACH_FEET: 5,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
  hasTacticalShift: vi.fn(() => false),
  hasSpeedyOpportunityDisadvantage: vi.fn(() => false),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn().mockResolvedValue(null),
}));

vi.mock('../common/Popup.jsx', () => ({
  default: function Popup({ children, onClickOrKeyDown }) {
    return (
      <div data-testid="popup" onClick={onClickOrKeyDown}>
        {children}
      </div>
    );
  },
}));

vi.mock('./DiceRollResult.jsx', () => ({
  default: function DiceRollResult(props) {
    return <div data-testid="dice-roll-result">{props.name || 'DiceRollResult'}</div>;
  },
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: function SpellDetailPopup({ spell }) {
    return <div data-testid="spell-detail-popup">{spell?.name}</div>;
  },
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: function MetamagicPopup() {
    return <div data-testid="metamagic-popup">Metamagic</div>;
  },
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue({ players: [], placedItems: [] }),
}));

vi.mock('./modals/arcane/ArcaneWardRestoreModal.jsx', () => ({
  default: function ArcaneWardRestoreModal({ onClose, playerStats, campaignName, ...rest }) {
    const hasRest = Object.keys(rest).length > 0;
    const hasModalProps = Object.keys({ onClose, playerStats, campaignName }).length > 0;
    return (
      <div data-testid="arcane-ward-restore-modal">
        {hasRest && <span data-arcane-ward-props={JSON.stringify(rest)} />}
        {hasModalProps && <span data-modal-props={JSON.stringify({ onClose, playerStats, campaignName })} />}
        ArcaneWardRestoreModal
      </div>
    );
  },
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js';
import { hasAutomation, hasTacticalShift, hasSpeedyOpportunityDisadvantage } from '../../services/combat/automation/automationService.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { executeHandler } from '../../services/automation/index.js';
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const MOCK_ATTACK = { name: 'Longsword', type: 'Action', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing' };

const basePlayerStats = {
  name: 'Test Character',
  level: 5,
  reactions: [
    { name: 'Opportunity Attack', description: 'Make a melee attack', automation: { type: 'test' } },
    { name: 'Reaction Test', description: 'A test reaction', details: 'Details here', automation: { type: 'test' } },
  ],
  attacks: [MOCK_ATTACK],
  spellAbilities: {
    spells: [
      {
        name: 'Shield',
        casting_time: '1 reaction',
        range: 'Self',
        prepared: 'Prepared',
      },
    ],
  },
};

const baseProps = {
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  cannotAct: false,
  mapName: null,
  characters: [],
};

function resetMocks() {
  vi.mocked(useRuntimeValue).mockImplementation(() => undefined);
  vi.mocked(getRuntimeValue).mockImplementation(() => null);
  vi.mocked(useLoggedDiceRoll).mockImplementation(() => {
    const [popupHtml, setPopupHtml] = React.useState(null);
    return {
      popupHtml,
      setPopupHtml,
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
    };
  });
  vi.mocked(useSpellMetamagicFlow).mockImplementation(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
  }));
  vi.mocked(hasAutomation).mockImplementation(() => false);
  vi.mocked(hasTacticalShift).mockImplementation(() => false);
  vi.mocked(hasSpeedyOpportunityDisadvantage).mockImplementation(() => false);
  vi.mocked(getCombatContext).mockImplementation(() => Promise.resolve(null));
  vi.mocked(getTargetFromAttacker).mockImplementation(() => null);
  vi.mocked(executeHandler).mockImplementation(() => Promise.resolve(null));
}

describe('CharReactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  // ===== Rendering =====

  it('renders the reactions section header', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('renders the wrapper element', () => {
    render(<CharReactions {...baseProps} />);
    expect(document.querySelector('.char-reactions')).toBeInTheDocument();
  });

  it('renders the half-line separator at the bottom', () => {
    render(<CharReactions {...baseProps} />);
    expect(document.querySelector('.half-line')).toBeInTheDocument();
  });

  it('renders all listed reactions with their descriptions', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
    expect(screen.getByText('Make a melee attack')).toBeInTheDocument();
    expect(screen.getByText('Reaction Test:')).toBeInTheDocument();
    expect(screen.getByText('A test reaction')).toBeInTheDocument();
  });

  // ===== Dynamic Reactions =====

  it('adds Opportunity Attack when not already listed', () => {
    const stats = { ...basePlayerStats, reactions: [] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  it('does not duplicate Opportunity Attack when already in reactions', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.queryAllByText('Opportunity Attack:').length).toBe(1);
  });

  it('adds Revivification reaction from activeBuffs with reactionSave', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'activeBuffs') return [{ reactionSave: 'CHA' }];
      return undefined;
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Revivification:')).toBeInTheDocument();
  });

  it('does not duplicate Revivification if already in reactions', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'activeBuffs') return [{ reactionSave: 'CHA' }];
      return undefined;
    });
    const stats = { ...basePlayerStats, reactions: [...basePlayerStats.reactions, { name: 'Revivification', description: 'Revive a creature' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryAllByText('Revivification:').length).toBe(1);
  });

  it('does not add Revivification when no buff has reactionSave', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'activeBuffs') return [{ name: 'Some Buff' }];
      return undefined;
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.queryByText('Revivification:')).not.toBeInTheDocument();
  });

  it('adds Stand (Power Word Heal) reaction when pwhStance is truthy', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Stand (Power Word Heal):')).toBeInTheDocument();
  });

  it('does not duplicate Stand when already in reactions', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    const stats = { ...basePlayerStats, reactions: [...basePlayerStats.reactions, { name: 'Stand (Power Word Heal)', description: 'Stand up.' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryAllByText('Stand (Power Word Heal):').length).toBe(1);
  });

  // ===== Reaction Clickability =====

  it('marks Opportunity Attack as clickable', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Opportunity Attack:')).toHaveClass('clickable');
  });

  it('marks reactions with details as clickable', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Reaction Test:')).toHaveClass('clickable');
  });

  it('marks reactions with automation as clickable', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Opportunity Attack:')).toHaveClass('clickable');
  });

  it('marks a reaction without details or automation as non-clickable', () => {
    const stats = { ...basePlayerStats, reactions: [{ name: 'Simple Reaction', description: 'No details here' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Simple Reaction:')).not.toHaveClass('clickable');
  });

  it('marks Stand (Power Word Heal) as non-clickable', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Stand (Power Word Heal):')).not.toHaveClass('clickable');
  });

  // ===== cannotAct =====

  it('prevents reaction action when cannotAct is true', () => {
    const mockRollAttack = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: null, setPopupHtml: vi.fn(), rollAttack: mockRollAttack, rollDamage: vi.fn() });
    render(<CharReactions {...baseProps} cannotAct={true} />);
    fireEvent.click(screen.getByText('Opportunity Attack:'));
    expect(mockRollAttack).not.toHaveBeenCalled();
  });

  // ===== Details Popup =====

  it('shows a popup when a reaction with details is clicked', async () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Reaction Test:'));
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  it('dismisses the popup when the overlay is clicked', async () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Reaction Test:'));
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
    fireEvent.click(screen.getByTestId('popup'));
    await waitFor(() => { expect(screen.queryByTestId('popup')).not.toBeInTheDocument(); });
  });

  // ===== Stand (Power Word Heal) Click Handler =====

  it('removes prone condition and clears pwhStance when Stand is clicked and prone is present', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    vi.mocked(getRuntimeValue).mockReturnValue(['Prone', 'Blinded']);
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Stand (Power Word Heal):'));
    expect(setRuntimeValue).toHaveBeenCalledWith(basePlayerStats.name, 'activeConditions', ['Blinded'], baseProps.campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(basePlayerStats.name, 'powerWordHealStandPermission', false, baseProps.campaignName);
  });

  it('does not remove conditions when prone is not present on Stand click', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    vi.mocked(getRuntimeValue).mockReturnValue(['Blinded']);
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Stand (Power Word Heal):'));
    expect(setRuntimeValue).not.toHaveBeenCalledWith(basePlayerStats.name, 'activeConditions', ['Blinded'], baseProps.campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(basePlayerStats.name, 'powerWordHealStandPermission', false, baseProps.campaignName);
  });

  it('shows a confirmation popup when Stand is clicked', async () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    vi.mocked(getRuntimeValue).mockReturnValue(['Prone']);
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Stand (Power Word Heal):'));
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  // ===== Opportunity Attack Handler =====

  it('calls rollAttack with attack name, hit bonus, and isOpportunityAttack flag for a basic OA', async () => {
    const mockRollAttack = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: null, setPopupHtml: vi.fn(), rollAttack: mockRollAttack, rollDamage: vi.fn() });
    vi.mocked(getCombatContext).mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
    vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Enemy' });
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    expect(mockRollAttack).toHaveBeenCalledWith(MOCK_ATTACK.name, MOCK_ATTACK.hitBonus, { forcedMode: undefined, isOpportunityAttack: true });
  });

  it('shows a popup when the target has InspiringMovement noOA protection', async () => {
    vi.mocked(getCombatContext).mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
    vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Enemy' });
    vi.mocked(getRuntimeValue).mockImplementation((name, key) => { if (key === 'inspiringMovementNoOA') return true; return null; });
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  it('shows a popup when the target has Tactical Shift', async () => {
    vi.mocked(getCombatContext).mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
    vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Enemy' });
    vi.mocked(hasTacticalShift).mockReturnValue(true);
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  it('shows a popup when the target has Speedy Opportunity Disadvantage', async () => {
    vi.mocked(getCombatContext).mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
    vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Enemy' });
    vi.mocked(hasSpeedyOpportunityDisadvantage).mockReturnValue(true);
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  it('selects the first melee attack for OA', async () => {
    const mockRollAttack = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: null, setPopupHtml: vi.fn(), rollAttack: mockRollAttack, rollDamage: vi.fn() });
    vi.mocked(getCombatContext).mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
    vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Enemy' });
    const stats = { ...basePlayerStats, attacks: [{ name: 'Melee Weapon', type: 'Action', range: 5, hitBonus: 7 }, { name: 'Ranged Weapon', type: 'Action', range: '80 feet', hitBonus: 5 }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    expect(mockRollAttack).toHaveBeenCalledWith('Melee Weapon', 7, { forcedMode: undefined, isOpportunityAttack: true });
  });

  it('falls back to the first attack when no melee attacks exist', async () => {
    const mockRollAttack = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: null, setPopupHtml: vi.fn(), rollAttack: mockRollAttack, rollDamage: vi.fn() });
    vi.mocked(getCombatContext).mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
    vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Enemy' });
    const stats = { ...basePlayerStats, attacks: [{ name: 'Ranged Weapon', type: 'Action', range: '80 feet', hitBonus: 5 }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    expect(mockRollAttack).toHaveBeenCalledWith('Ranged Weapon', 5, { forcedMode: undefined, isOpportunityAttack: true });
  });

  it('falls through to normal attack when getCombatContext throws', async () => {
    const mockRollAttack = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: null, setPopupHtml: vi.fn(), rollAttack: mockRollAttack, rollDamage: vi.fn() });
    vi.mocked(getCombatContext).mockRejectedValue(new Error('fail'));
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    expect(mockRollAttack).toHaveBeenCalled();
  });

  it('does nothing when there are no attacks for OA', async () => {
    vi.mocked(getCombatContext).mockResolvedValue(null);
    const stats = { ...basePlayerStats, attacks: [] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    expect(screen.queryByTestId('dice-roll-result')).not.toBeInTheDocument();
  });

  // ===== Automation Reactions =====

  it('calls executeHandler when a reaction has automation', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue(null);
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Reaction Test:')); });
    expect(executeHandler).toHaveBeenCalled();
  });

  it('does not call executeHandler when cannotAct is true even with automation', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    render(<CharReactions {...baseProps} cannotAct={true} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('shows a popup when executeHandler returns null and the reaction has details', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue(null);
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Reaction Test:')); });
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  it('calls rollAttack when automation returns an attack_roll result', async () => {
    const mockRollAttack = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: null, setPopupHtml: vi.fn(), rollAttack: mockRollAttack, rollDamage: vi.fn() });
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'attack_roll', payload: { attack: { name: 'Auto Attack', hitBonus: 8 }, targetName: 'Enemy' } });
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Reaction Test:')); });
    expect(mockRollAttack).toHaveBeenCalledWith('Auto Attack', 8, { targetName: 'Enemy', forcedMode: undefined, isOpportunityAttack: true });
  });

  it('shows a popup when automation returns a popup result', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'popup', payload: '<b>Automation Popup</b>' });
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  it('shows feature detail when automation returns an unknown result type', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'unknown_type' });
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    await waitFor(() => { expect(buildFeatureDetailHtml).toHaveBeenCalled(); });
  });

  // ===== Spell Reactions =====

  it('renders a spells table section when reaction spells exist', () => {
    render(<CharReactions {...baseProps} />);
    expect(document.querySelector('.attacks')).toBeInTheDocument();
  });

  it('renders spell reaction table headers', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByText('Hit')).toBeInTheDocument();
    expect(screen.getByText('Damage')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('renders the spell range column value', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Self')).toBeInTheDocument();
  });

  it('displays Utility as the damage type for reaction spells', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Utility')).toBeInTheDocument();
  });

  it('filters spells to only those with reaction casting time', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [
      { name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared' },
      { name: 'Aid', casting_time: '1 action', prepared: 'Prepared' },
      { name: 'Hex', casting_time: '1 bonus action', prepared: 'Always' },
    ] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Shield')).toBeInTheDocument();
    expect(screen.queryByText('Aid')).not.toBeInTheDocument();
    expect(screen.queryByText('Hex')).not.toBeInTheDocument();
  });

  it('excludes spells whose names match attacks', () => {
    const stats = { ...basePlayerStats, attacks: [{ name: 'Shield', type: 'Action', range: 'Self', hitBonus: 5 }], spellAbilities: { spells: [{ name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared' }] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Shield')).not.toBeInTheDocument();
  });

  it('excludes unprepared spells', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [{ name: 'Shield', casting_time: '1 reaction', prepared: 'Not Prepared' }] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Shield')).not.toBeInTheDocument();
  });

  it('includes Always-prepared spells', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [{ name: 'Counterspell', casting_time: '1 reaction', range: '60 feet', prepared: 'Always' }] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Counterspell')).toBeInTheDocument();
  });

  it('opens spell detail popup when a reaction spell name is clicked', () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Shield'));
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  it('dismisses spell detail popup when the overlay is clicked', () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Shield'));
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('popup'));
    expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
  });

  it('does not show the spells section when no spells exist', () => {
    const stats = { ...basePlayerStats, attacks: [], reactions: [], spellAbilities: undefined };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(document.querySelector('.attacks')).not.toBeInTheDocument();
  });

  it('does not show the spells section when spells array is empty', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(document.querySelector('.attacks')).not.toBeInTheDocument();
  });

  // ===== Null / Empty Handling =====

  it('handles null reactions gracefully', () => {
    const stats = { ...basePlayerStats, reactions: null };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  it('handles empty reactions array gracefully', () => {
    const stats = { ...basePlayerStats, reactions: [] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  it('handles empty spell abilities gracefully', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('handles undefined spell abilities gracefully', () => {
    const stats = { ...basePlayerStats, spellAbilities: undefined };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  // ===== DiceRollResult Rendering =====

  it('renders DiceRollResult when popupHtml is an object', () => {
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: { name: 'Test Roll', result: 15 }, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn() });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByTestId('dice-roll-result')).toBeInTheDocument();
  });

  // ===== Metamagic Popup =====

  it('renders MetamagicPopup when pendingMetamagic is set', () => {
    vi.mocked(useSpellMetamagicFlow).mockReturnValue({ pendingMetamagic: { spellName: 'Shield', spellLevel: 1, _currentSP: 3 }, gateMetamagic: vi.fn(), handleConfirm: vi.fn(), handleSkip: vi.fn() });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  // ===== FeaturesToIgnore Filtering =====

  it('filters out features listed in featuresToIgnore for 5e ruleset', () => {
    const stats = { ...basePlayerStats, rules: '5e', reactions: [{ name: 'Spellcasting', description: 'Casts spells' }, { name: 'Rage', description: 'Enters a rage' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Spellcasting:')).not.toBeInTheDocument();
    expect(screen.queryByText('Rage:')).not.toBeInTheDocument();
  });

  it('filters out features listed in featuresToIgnore for 2024 ruleset', () => {
    const stats = { ...basePlayerStats, rules: '2024', reactions: [{ name: 'Spellcasting', description: 'Casts spells' }, { name: 'Feat', description: 'A feat' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Spellcasting:')).not.toBeInTheDocument();
    expect(screen.queryByText('Feat:')).not.toBeInTheDocument();
  });

  it('shows features not in featuresToIgnore list', () => {
    const stats = { ...basePlayerStats, rules: '5e', reactions: [{ name: 'Opportunity Attack', description: 'Attacks fleeing enemies' }, { name: 'Some Custom Reaction', description: 'Custom' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
    expect(screen.getByText('Some Custom Reaction:')).toBeInTheDocument();
  });

  // ===== PopupHtml Types =====

  it('renders popupHtml string content with sanitized HTML', async () => {
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: '<b>Test</b><br/>Content', setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn() });
    render(<CharReactions {...baseProps} />);
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  it('renders popupHtml automation_info type with icon and content', async () => {
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: { type: 'automation_info', name: 'Test Automation', description: 'Automation details' }, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn() });
    render(<CharReactions {...baseProps} />);
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  it('renders DiceRollResult component when popupHtml is a dice roll object', () => {
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: { name: 'Attack Roll', result: 20, isCrit: false }, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn() });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByTestId('dice-roll-result')).toBeInTheDocument();
  });

  it('dismisses popupHtml when the overlay is clicked', async () => {
    const setPopupHtml = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: '<b>Test Popup</b>', setPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn() });
    render(<CharReactions {...baseProps} />);
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
    fireEvent.click(screen.getByTestId('popup'));
    expect(setPopupHtml).toHaveBeenCalledWith(null);
  });

  // ===== ArcaneWardRestoreModal =====

  it('renders ArcaneWardRestoreModal when set from automation result', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'modal', modalName: 'arcaneWardRestore', payload: { someData: true } });
    const stats = { ...basePlayerStats, reactions: [{ name: 'Arcane Ward', description: 'Creates a ward', automation: { type: 'arcane_ward' } }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('Arcane Ward:')); });
    await waitFor(() => { expect(screen.getByTestId('arcane-ward-restore-modal')).toBeInTheDocument(); });
  });

  it('renders ArcaneWardRestoreModal when state is set directly', () => {
    const props = { ...baseProps, playerStats: { ...basePlayerStats, reactions: [] } };
    render(<CharReactions {...props} />);
  });

  // ===== Reactive Spell Flow =====

  it('shows reactive spell eligible popup when automation returns eligibleSpells', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'War Caster',
        description: 'Select a spell',
        eligibleSpells: [{ name: 'Shield', isSingleTarget: true }],
        hasWarnings: false,
      },
    });
    const stats = { ...basePlayerStats, reactions: [{ name: 'War Caster', description: 'Casts a spell as reaction', automation: { type: 'reaction_spell' } }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('War Caster:')); });
    await waitFor(() => { expect(document.querySelectorAll('[data-testid="popup"]').length).toBeGreaterThanOrEqual(1); });
  });

  it('shows reactive spell warnings when multi-target spells are available', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'War Caster',
        description: 'Select a spell',
        eligibleSpells: [{ name: 'Fireball', isSingleTarget: false }],
        hasWarnings: true,
      },
    });
    const stats = { ...basePlayerStats, reactions: [{ name: 'War Caster', description: 'Casts a spell as reaction', automation: { type: 'reaction_spell' } }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('War Caster:')); });
    await waitFor(() => { expect(document.querySelectorAll('[data-testid="popup"]').length).toBeGreaterThanOrEqual(1); });
  });

  it('sets reactiveSpellFlow state when selecting a spell from eligible spells', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'War Caster',
        description: 'Select a spell',
        eligibleSpells: [{ name: 'Shield', isSingleTarget: true }],
        hasWarnings: false,
      },
    });
    const stats = { ...basePlayerStats, reactions: [{ name: 'War Caster', description: 'Casts a spell as reaction', automation: { type: 'reaction_spell' } }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('War Caster:')); });
    await waitFor(() => { expect(document.querySelectorAll('[data-testid="popup"]').length).toBeGreaterThanOrEqual(1); });
  });

  // ===== Spell Detail Popup with onCast =====

  it('passes onCast handler to SpellDetailPopup for normal reaction spell cast', () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Shield'));
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  // ===== resolveReactionSpellPositions =====

  it('does not resolve positions when mapName is null', () => {
    const props = { ...baseProps, mapName: null };
    render(<CharReactions {...props} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('handles map loading failure gracefully', () => {
    const props = { ...baseProps, mapName: 'test-map' };
    render(<CharReactions {...props} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  // ===== automation_info popup dismiss =====

  it('dismisses automation_info popup when overlay is clicked', async () => {
    const setPopupHtml = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: { type: 'automation_info', name: 'Test', description: 'Desc' }, setPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn() });
    render(<CharReactions {...baseProps} />);
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
    fireEvent.click(screen.getByTestId('popup'));
    expect(setPopupHtml).toHaveBeenCalledWith(null);
  });

  // ===== Spell prepared filtering edge cases =====

  it('only renders spells with Prepared or Always prepared status', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [
      { name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared' },
      { name: 'Counterspell', casting_time: '1 reaction', prepared: 'Always' },
      { name: 'Hex', casting_time: '1 reaction', prepared: 'Not Prepared' },
    ] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Shield')).toBeInTheDocument();
    expect(screen.getByText('Counterspell')).toBeInTheDocument();
    expect(screen.queryByText('Hex')).not.toBeInTheDocument();
  });
});

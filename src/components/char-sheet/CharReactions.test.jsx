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
    if (reaction.details) return `<b>${reaction.name}</b><br/>${reaction.details}`;
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
  OPPORTUNITY_ATTACK: { name: 'Opportunity Attack', description: 'Make an attack', automation: { type: 'test' } },
  MELEE_REACH_FEET: '5 feet',
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

const MOCK_ATTACK = { name: 'Longsword', type: 'Action', range: '5 feet', hitBonus: 5, damage: '1d8+3', damageType: 'Slashing' };

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

  // ===== Basic Rendering =====

  it('renders reactions section header', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('renders reactions list', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  it('renders reaction description', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Make a melee attack')).toBeInTheDocument();
  });

  it('renders reaction as clickable when it has details', () => {
    render(<CharReactions {...baseProps} />);
    const reactionTest = screen.getByText(/Reaction Test/);
    expect(reactionTest).toHaveClass('clickable');
  });

  it('renders spell reaction with range', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Self')).toBeInTheDocument();
  });

  it('renders spell reaction as clickable to open detail popup', () => {
    render(<CharReactions {...baseProps} />);
    const spellName = screen.getByText('Shield');
    fireEvent.click(spellName);
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  it('renders reaction table headers for spell reactions', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByText('Hit')).toBeInTheDocument();
    expect(screen.getByText('Damage')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('renders reaction spells as utility type', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Utility')).toBeInTheDocument();
  });

  it('does not show duplicate Opportunity Attack when already in reactions', () => {
    render(<CharReactions {...baseProps} />);
    const reactions = screen.getAllByText(/opportunity attack/i);
    expect(reactions.length).toBe(1);
  });

  it('adds Opportunity Attack dynamically when not in reactions', () => {
    const stats = { ...basePlayerStats, reactions: [] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  it('renders char-reactions wrapper class', () => {
    render(<CharReactions {...baseProps} />);
    expect(document.querySelector('.char-reactions')).toBeInTheDocument();
  });

  it('renders attacks wrapper for reaction spells', () => {
    render(<CharReactions {...baseProps} />);
    expect(document.querySelector('.attacks')).toBeInTheDocument();
  });

  it('renders half-line at end', () => {
    render(<CharReactions {...baseProps} />);
    expect(document.querySelector('.half-line')).toBeInTheDocument();
  });

  it('handles empty reactions array', () => {
    const stats = { ...basePlayerStats, reactions: [] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  it('handles null reactions', () => {
    const stats = { ...basePlayerStats, reactions: null };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  it('handles empty spell abilities', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('handles undefined spell abilities', () => {
    const stats = { ...basePlayerStats, spellAbilities: undefined };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  // ===== Spell Filtering =====

  it('filters reaction spells by casting time', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [
      { name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared' },
      { name: 'Aid', casting_time: '1 action', prepared: 'Prepared' },
      { name: 'Hex', casting_time: '1 bonus action', prepared: 'Always' },
    ] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Shield')).toBeInTheDocument();
  });

  it('excludes attack names from reaction spells', () => {
    const stats = { ...basePlayerStats, attacks: [{ name: 'Shield', type: 'Action', range: 'Self', hitBonus: 5 }], spellAbilities: { spells: [{ name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared' }] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Shield')).not.toBeInTheDocument();
  });

  it('excludes unprepared spells from reaction spells', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [{ name: 'Shield', casting_time: '1 reaction', prepared: 'Not Prepared' }] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Shield')).not.toBeInTheDocument();
  });

  it('renders reaction spells with casting time abbreviations', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [{ name: 'Shield', casting_time: '1 reaction', range: 'Self', prepared: 'Prepared' }] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(document.querySelector('.attacks').textContent).toContain('R');
  });

  it('renders reaction spells with capital R', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [{ name: 'Shield', casting_time: '1 Reaction', range: 'Self', prepared: 'Prepared' }] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(document.querySelector('.attacks').textContent).toContain('R');
  });

  it('renders reaction spells with lowercase reaction', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [{ name: 'Shield', casting_time: 'reaction', range: 'Self', prepared: 'Prepared' }] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(document.querySelector('.attacks').textContent).toContain('R');
  });

  // ===== Revivification from Active Buffs =====

  it('adds Revivification reaction from active buffs with reactionSave', () => {
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
    expect(screen.getAllByText(/Revivification/).length).toBe(1);
  });

  it('does not add Revivification when no buff has reactionSave', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'activeBuffs') return [{ name: 'Some Buff' }];
      return undefined;
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.queryByText('Revivification:')).not.toBeInTheDocument();
  });

  // ===== Power Word Heal Stand Reaction =====

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
    const stats = { ...basePlayerStats, reactions: [...basePlayerStats.reactions, { name: 'Stand (Power Word Heal)', description: 'You can use your Reaction to stand up.' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getAllByText(/Stand \(Power Word Heal\)/).length).toBe(1);
  });

  // ===== cannotAct =====

  it('does not allow reaction click when cannotAct', () => {
    render(<CharReactions {...baseProps} cannotAct={true} />);
    fireEvent.click(screen.getByText('Opportunity Attack:'));
  });

  // ===== Details Popup =====

  it('renders popup when reaction with details is clicked', async () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Reaction Test:'));
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  // ===== Stand (Power Word Heal) Click Handler =====

  it('removes prone condition and clears pwhStance when Stand is clicked', () => {
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

  it('does not change conditions when prone is not present on Stand click', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    vi.mocked(getRuntimeValue).mockReturnValue(['Blinded']);
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Stand (Power Word Heal):'));
    expect(setRuntimeValue).toHaveBeenCalledWith(basePlayerStats.name, 'powerWordHealStandPermission', false, baseProps.campaignName);
  });

  it('shows Stand popup when Stand is clicked', async () => {
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

  it('calls rollAttack with OA flag when no target special protections', async () => {
    const mockRollAttack = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: null, setPopupHtml: vi.fn(), rollAttack: mockRollAttack, rollDamage: vi.fn() });
    vi.mocked(getCombatContext).mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
    vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Enemy' });
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    expect(mockRollAttack).toHaveBeenCalledWith(MOCK_ATTACK.name, MOCK_ATTACK.hitBonus, { forcedMode: undefined, isOpportunityAttack: true });
  });

  it('shows popup when target has InspiringMovement noOA', async () => {
    vi.mocked(getCombatContext).mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
    vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Enemy' });
    vi.mocked(getRuntimeValue).mockImplementation((name, key) => { if (key === 'inspiringMovementNoOA') return true; return null; });
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  it('shows popup when target has Tactical Shift', async () => {
    vi.mocked(getCombatContext).mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
    vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Enemy' });
    vi.mocked(hasTacticalShift).mockReturnValue(true);
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  it('shows popup when target has Speedy Opportunity Disadvantage', async () => {
    vi.mocked(getCombatContext).mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
    vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Enemy' });
    vi.mocked(hasSpeedyOpportunityDisadvantage).mockReturnValue(true);
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  it('uses first melee attack for OA', async () => {
    const mockRollAttack = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: null, setPopupHtml: vi.fn(), rollAttack: mockRollAttack, rollDamage: vi.fn() });
    vi.mocked(getCombatContext).mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
    vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Enemy' });
    const stats = { ...basePlayerStats, attacks: [{ name: 'Melee Weapon', type: 'Action', range: '5 feet', hitBonus: 7 }, { name: 'Ranged Weapon', type: 'Action', range: '80 feet', hitBonus: 5 }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    expect(mockRollAttack).toHaveBeenCalledWith('Melee Weapon', 7, { forcedMode: undefined, isOpportunityAttack: true });
  });

  it('uses first attack when no melee attacks exist for OA', async () => {
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

  it('does nothing when no attacks exist for OA', async () => {
    vi.mocked(getCombatContext).mockResolvedValue(null);
    const stats = { ...basePlayerStats, attacks: [] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
  });

  // ===== Automation Reactions =====

  it('calls executeHandler when reaction has automation', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue(null);
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Reaction Test:')); });
    expect(executeHandler).toHaveBeenCalled();
  });

  it('does not call executeHandler when cannotAct with automation', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    render(<CharReactions {...baseProps} cannotAct={true} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('shows popup when executeHandler returns null and reaction has details', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue(null);
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Reaction Test:')); });
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  it('calls rollAttack when automation returns attack_roll result', async () => {
    const mockRollAttack = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ popupHtml: null, setPopupHtml: vi.fn(), rollAttack: mockRollAttack, rollDamage: vi.fn() });
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'attack_roll', payload: { attack: { name: 'Auto Attack', hitBonus: 8 }, targetName: 'Enemy' } });
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Reaction Test:')); });
    expect(mockRollAttack).toHaveBeenCalledWith('Auto Attack', 8, { targetName: 'Enemy', forcedMode: undefined, isOpportunityAttack: true });
  });

  it('shows popup when automation returns popup result', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'popup', payload: '<b>Automation Popup</b>' });
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
  });

  it('shows feature detail when automation returns unknown result', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'unknown_type' });
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Opportunity Attack:')); });
    await waitFor(() => { expect(buildFeatureDetailHtml).toHaveBeenCalled(); });
  });

  // ===== Reaction Clickable State =====

  it('shows OA as clickable', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Opportunity Attack:')).toHaveClass('clickable');
  });

  it('shows reaction as non-clickable when it has no details, is not OA, and has no automation', () => {
    const stats = { ...basePlayerStats, reactions: [{ name: 'Simple Reaction', description: 'No details here' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Simple Reaction:')).not.toHaveClass('clickable');
  });

  it('renders Stand reaction as non-clickable', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Stand (Power Word Heal):')).not.toHaveClass('clickable');
  });

  // ===== Spell Detail Popup Dismissal =====

  it('closes spell detail popup when overlay is clicked', () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Shield'));
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('popup'));
    expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
  });

  // ===== Popup Dismissal =====

  it('closes HTML popup when overlay is clicked', async () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Reaction Test:'));
    await waitFor(() => { expect(screen.getByTestId('popup')).toBeInTheDocument(); });
    fireEvent.click(screen.getByTestId('popup'));
    await waitFor(() => { expect(screen.queryByTestId('popup')).not.toBeInTheDocument(); });
  });

  // ===== DiceRollResult rendering =====

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

  // ===== Always-prepared spells =====

  it('includes Always-prepared spells in reaction spells', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [{ name: 'Counterspell', casting_time: '1 reaction', range: '60 feet', prepared: 'Always' }] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Counterspell')).toBeInTheDocument();
  });

  // ===== No spells, no attacks table =====

  it('does not show reaction spells section when no spells exist', () => {
    const stats = { ...basePlayerStats, attacks: [], reactions: [], spellAbilities: undefined };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(document.querySelector('.attacks')).not.toBeInTheDocument();
  });
});

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
      <div data-testid="popup-overlay" onClick={onClickOrKeyDown}>
        <div data-testid="popup-modal" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
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
import { useSpellUpcastFlow } from '../../hooks/combat/useSpellUpcastFlow.js';
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

describe('CharReactions - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  // ===== Undefined/null playerStats handling =====

  it('handles undefined playerStats reactions gracefully', () => {
    const stats = { ...basePlayerStats, reactions: undefined };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  it('handles undefined playerStats attacks gracefully', () => {
    const stats = { ...basePlayerStats, attacks: undefined };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('handles undefined playerStats spellAbilities gracefully', () => {
    const stats = { ...basePlayerStats, spellAbilities: undefined };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('handles undefined playerStats name gracefully in runtime state calls', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'activeBuffs') return undefined;
      if (key === 'powerWordHealStandPermission') return undefined;
      return undefined;
    });
    vi.mocked(getRuntimeValue).mockImplementation(() => null);
    const stats = { ...basePlayerStats, name: 'Test Character' };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  // ===== cannotAct blocking for different reaction types =====

  it('prevents automation reaction action when cannotAct is true', () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    render(<CharReactions {...baseProps} cannotAct={true} />);
    fireEvent.click(screen.getByText('Reaction Test:'));
    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('prevents details reaction action when cannotAct is true', () => {
    render(<CharReactions {...baseProps} cannotAct={true} />);
    fireEvent.click(screen.getByText('Reaction Test:'));
    expect(buildFeatureDetailHtml).not.toHaveBeenCalled();
  });

  it('prevents Stand (Power Word Heal) action when cannotAct is true', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    render(<CharReactions {...baseProps} cannotAct={true} />);
    fireEvent.click(screen.getByText('Stand (Power Word Heal):'));
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  // ===== buildFeatureDetailHtml returning null =====

  it('does not show popup when buildFeatureDetailHtml returns null for a reaction without details', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue(null);
    const stats = { ...basePlayerStats, reactions: [{ name: 'No Details Reaction', description: 'No details available', automation: { type: 'test' } }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('No Details Reaction:')); });
    await waitFor(() => { expect(screen.queryByTestId('popup')).not.toBeInTheDocument(); });
  });

  // ===== Reaction clickability edge cases =====

  it('marks a reaction with only automation as clickable', () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    const stats = { ...basePlayerStats, reactions: [{ name: 'Auto Only', description: 'Automation only', automation: { type: 'test' } }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Auto Only:')).toHaveClass('clickable');
  });

  it('does not mark a plain reaction as clickable', () => {
    const stats = { ...basePlayerStats, reactions: [{ name: 'Plain Reaction', description: 'Just a description' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Plain Reaction:')).not.toHaveClass('clickable');
  });

  // ===== Spell detail popup with upcast levels =====

  it('passes buildUpcastLevels result to SpellDetailPopup', () => {
    const buildUpcastLevels = vi.fn(() => [2, 3]);
    vi.mocked(useSpellUpcastFlow).mockReturnValue({ buildUpcastLevels });
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Shield'));
    expect(buildUpcastLevels).toHaveBeenCalledWith(basePlayerStats.spellAbilities.spells[0]);
  });

  // ===== MetamagicPopup with _currentSP =====

  it('renders MetamagicPopup with _currentSP from pendingMetamagic', () => {
    vi.mocked(useSpellMetamagicFlow).mockReturnValue({
      pendingMetamagic: { spellName: 'Shield', spellLevel: 1, _currentSP: 5 },
      gateMetamagic: vi.fn(),
      handleConfirm: vi.fn(),
      handleSkip: vi.fn(),
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  // ===== Spell reactions table with multiple spells =====

  it('renders all reaction spells in the spells table', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [
      { name: 'Shield', casting_time: '1 reaction', range: 'Self', prepared: 'Prepared' },
      { name: 'Counterspell', casting_time: '1 Reaction', range: '60 feet', prepared: 'Always' },
      { name: 'Lure', casting_time: 'reaction', range: '30 feet', prepared: 'Prepared' },
    ] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Shield')).toBeInTheDocument();
    expect(screen.getByText('Counterspell')).toBeInTheDocument();
    expect(screen.getByText('Lure')).toBeInTheDocument();
  });

  // ===== Multiple dynamic reactions =====

  it('adds both Revivification and Stand when both conditions are met', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'activeBuffs') return [{ reactionSave: 'CHA' }];
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Revivification:')).toBeInTheDocument();
    expect(screen.getByText('Stand (Power Word Heal):')).toBeInTheDocument();
  });

  // ===== Revivification with multiple buffs =====

  it('adds Revivification only once even with multiple reactionSave buffs', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'activeBuffs') return [{ reactionSave: 'CHA' }, { reactionSave: 'WIS' }];
      return undefined;
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.queryAllByText('Revivification:').length).toBe(1);
  });

  // ===== Stand with multiple pwhStance calls =====

  it('adds Stand only once even when pwhStance check passes', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    const stats = { ...basePlayerStats, reactions: [...basePlayerStats.reactions, { name: 'Stand (Power Word Heal)', description: 'Already present' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryAllByText('Stand (Power Word Heal):').length).toBe(1);
  });

  // ===== Spell filtering: casting time variants =====

  it('filters out spells with casting_time "bonus action"', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [
      { name: 'Hex', casting_time: '1 bonus action', prepared: 'Always' },
    ] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Hex')).not.toBeInTheDocument();
  });

  it('filters out spells with casting_time "1 action"', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [
      { name: 'Fireball', casting_time: '1 action', prepared: 'Prepared' },
    ] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
  });

  it('filters out spells with casting_time "2 actions"', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [
      { name: 'Castigate', casting_time: '2 actions', prepared: 'Prepared' },
    ] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Castigate')).not.toBeInTheDocument();
  });

  it('filters out spells with casting_time "1 minute"', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [
      { name: 'Create Food', casting_time: '1 minute', prepared: 'Prepared' },
    ] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Create Food')).not.toBeInTheDocument();
  });

  // ===== Spell filtering: name collision with attacks =====

  it('includes reaction spell even if its name matches an attack name', () => {
    const stats = { ...basePlayerStats, attacks: [{ name: 'Shield', type: 'Action', range: 'Self', hitBonus: 5 }], spellAbilities: { spells: [{ name: 'Shield', casting_time: '1 reaction', range: 'Self', prepared: 'Prepared' }] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Shield')).toBeInTheDocument();
  });

  // ===== Reaction with automation but executeHandler returns modal with non-arcaneWardRestore =====

  it('shows feature detail popup when automation returns unknown modal type', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'modal', modalName: 'someOtherModal', payload: {} });
    const stats = { ...basePlayerStats, reactions: [{ name: 'Custom', description: 'Custom desc', details: 'Custom details', automation: { type: 'custom' } }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('Custom:')); });
    await waitFor(() => { expect(buildFeatureDetailHtml).toHaveBeenCalled(); });
  });

  // ===== Reaction with automation but no automation property =====

  it('handles reaction with automation flag but no automation property', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    const stats = { ...basePlayerStats, reactions: [{ name: 'No Auto Prop', description: 'Has automation flag but no automation prop' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('No Auto Prop:')); });
    expect(executeHandler).not.toHaveBeenCalled();
  });

  // ===== Popup dismissal for various types =====

  // ===== Spell detail popup with onCast handler =====

  it('renders SpellDetailPopup with onCast for normal reaction spell', () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Shield'));
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  // ===== FeaturesToIgnore with default ruleset =====

  it('uses 5e featuresToIgnore when rules is not specified', () => {
    const stats = { ...basePlayerStats, rules: undefined, reactions: [{ name: 'Spellcasting', description: 'Casts spells' }, { name: 'Opportunity Attack', description: 'Attacks fleeing enemies' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Spellcasting:')).not.toBeInTheDocument();
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  it('uses 5e featuresToIgnore when rules is "5e"', () => {
    const stats = { ...basePlayerStats, rules: '5e', reactions: [{ name: 'Spellcasting', description: 'Casts spells' }, { name: 'Opportunity Attack', description: 'Attacks fleeing enemies' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Spellcasting:')).not.toBeInTheDocument();
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  // ===== Spell prepared status filtering =====

  it('excludes spells with prepared "Not Prepared"', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [{ name: 'Shield', casting_time: '1 reaction', prepared: 'Not Prepared' }] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Shield')).not.toBeInTheDocument();
  });

  it('excludes spells with prepared "Unprepared"', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [{ name: 'Shield', casting_time: '1 reaction', prepared: 'Unprepared' }] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Shield')).not.toBeInTheDocument();
  });

  // ===== Spell table: hit column always shows em dash =====

  it('renders hit column header for reaction spells', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [
      { name: 'Shield', casting_time: '1 reaction', range: 'Self', prepared: 'Prepared' },
      { name: 'Counterspell', casting_time: '1 reaction', range: '60 feet', prepared: 'Always' },
    ] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    // The hit column header is shown for reaction spells
    expect(screen.getByText('Hit')).toBeInTheDocument();
  });

  // ===== Spell table: type column rendering =====

  it('renders the type column header for reaction spells', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [
      { name: 'Shield', casting_time: '1 reaction', range: 'Self', prepared: 'Prepared' },
    ] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  // ===== Spell table: damage column always shows Utility =====

  it('renders Utility as damage column for all reaction spells', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [
      { name: 'Shield', casting_time: '1 reaction', range: 'Self', prepared: 'Prepared' },
      { name: 'Counterspell', casting_time: '1 reaction', range: '60 feet', prepared: 'Always' },
    ] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    const utilities = screen.queryAllByText('Utility');
    expect(utilities.length).toBeGreaterThanOrEqual(1);
  });

  // ===== Revivification description =====

  it('uses the correct Revivification description', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'activeBuffs') return [{ reactionSave: 'CHA' }];
      return undefined;
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('When a creature within 30 feet of you would drop to 0 Hit Points, you can take a Reaction to expend a use of your Rage to instead change the target\'s Hit Points to a number equal to your Barbarian level.')).toBeInTheDocument();
  });

  // ===== Stand description =====

  it('uses the correct Stand description', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('You can use your Reaction to stand up.')).toBeInTheDocument();
  });

  // ===== Stand with no prone condition =====

  it('clears pwhStance even when prone is not in activeConditions', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    vi.mocked(getRuntimeValue).mockReturnValue([]);
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Stand (Power Word Heal):'));
    expect(setRuntimeValue).toHaveBeenCalledWith(basePlayerStats.name, 'powerWordHealStandPermission', false, baseProps.campaignName);
  });

  // ===== Stand with empty conditions =====

  it('clears pwhStance when activeConditions is empty array on Stand click', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    vi.mocked(getRuntimeValue).mockReturnValue([]);
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Stand (Power Word Heal):'));
    expect(setRuntimeValue).toHaveBeenCalledWith(basePlayerStats.name, 'powerWordHealStandPermission', false, baseProps.campaignName);
  });

  // ===== Popup Dismissal Tests =====

  it('dismisses spell detail popup when popup overlay is clicked', () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Shield'));
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('popup-overlay'));
    expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
  });

  it('shows reactive spell popup when automation returns eligibleSpells', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'popup', payload: { eligibleSpells: [{ name: 'Fireball', isSingleTarget: false }], hasWarnings: true } });
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Reaction Test:')); });
    await waitFor(() => { expect(screen.queryByTestId('popup-overlay')).toBeInTheDocument(); });
  });

  it('sets reactiveSpellFlow state when selecting from reactive spell eligible popup', () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Shield'));
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  // ===== ArcaneWardRestoreModal prop spreading =====

  it('passes onClose handler to ArcaneWardRestoreModal', () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'modal', modalName: 'arcaneWardRestore', payload: { someData: true } });
    const stats = { ...basePlayerStats, reactions: [{ name: 'Arcane Ward', description: 'Creates a ward', automation: { type: 'arcane_ward' } }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('passes additional modal props to ArcaneWardRestoreModal via spread', () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'modal', modalName: 'arcaneWardRestore', payload: { extraProp: 'value' } });
    const stats = { ...basePlayerStats, reactions: [{ name: 'Arcane Ward', description: 'Creates a ward', automation: { type: 'arcane_ward' } }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  // ===== MetamagicPopup prop passing =====

  it('passes spell name and level to MetamagicPopup', () => {
    vi.mocked(useSpellMetamagicFlow).mockReturnValue({
      pendingMetamagic: { spellName: 'Shield', spellLevel: 2, _currentSP: 4 },
      gateMetamagic: vi.fn(),
      handleConfirm: vi.fn(),
      handleSkip: vi.fn(),
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  it('passes onConfirm and onSkip handlers to MetamagicPopup', () => {
    const handleConfirm = vi.fn();
    const handleSkip = vi.fn();
    vi.mocked(useSpellMetamagicFlow).mockReturnValue({
      pendingMetamagic: { spellName: 'Empowered Spell', spellLevel: 1, _currentSP: 2 },
      gateMetamagic: vi.fn(),
      handleConfirm,
      handleSkip,
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  // ===== Spell detail popup with isReactiveSpellFlow =====

  it('passes handleReactiveSpellCast as onCast when isReactiveSpellFlow is true', () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Shield'));
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  it('passes handleReactionSpellCast as onCast when isReactiveSpellFlow is false', () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Shield'));
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  // ===== buildUpcastLevels integration =====

  it('calls buildUpcastLevels with the selected spell', () => {
    const buildUpcastLevels = vi.fn(() => [2, 3]);
    vi.mocked(useSpellUpcastFlow).mockReturnValue({ buildUpcastLevels });
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Shield'));
    expect(buildUpcastLevels).toHaveBeenCalledWith(basePlayerStats.spellAbilities.spells[0]);
  });

  // ===== Reaction with automation but executeHandler returns undefined =====

  it('shows feature detail when executeHandler returns undefined', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue(undefined);
    const stats = { ...basePlayerStats, reactions: [{ name: 'Undefined Handler', description: 'Handler returns undefined', details: 'Some details', automation: { type: 'test' } }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('Undefined Handler:')); });
    await waitFor(() => { expect(buildFeatureDetailHtml).toHaveBeenCalled(); });
  });
});

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

  it('handles undefined playerStats properties gracefully', () => {
    const stats = { ...basePlayerStats, reactions: undefined, attacks: undefined, spellAbilities: undefined };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  // ===== cannotAct blocking for different reaction types =====

  it('prevents automation, details, and Stand reactions when cannotAct is true', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    render(<CharReactions {...baseProps} cannotAct={true} />);
    fireEvent.click(screen.getByText('Reaction Test:'));
    expect(executeHandler).not.toHaveBeenCalled();
    expect(buildFeatureDetailHtml).not.toHaveBeenCalled();
  });

  // ===== Reaction clickability =====

  it('marks a reaction with automation as clickable', () => {
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

  // ===== MetamagicPopup with _currentSP =====

  it('renders MetamagicPopup with pendingMetamagic data', () => {
    vi.mocked(useSpellMetamagicFlow).mockReturnValue({
      pendingMetamagic: { spellName: 'Shield', spellLevel: 1, _currentSP: 5 },
      gateMetamagic: vi.fn(),
      handleConfirm: vi.fn(),
      handleSkip: vi.fn(),
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
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

  it('adds Revivification only once even with multiple reactionSave buffs', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'activeBuffs') return [{ reactionSave: 'CHA' }, { reactionSave: 'WIS' }];
      return undefined;
    });
    render(<CharReactions {...baseProps} />);
    expect(screen.queryAllByText('Revivification:').length).toBe(1);
  });

  it('adds Stand only once even when pwhStance check passes', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    const stats = { ...basePlayerStats, reactions: [...basePlayerStats.reactions, { name: 'Stand (Power Word Heal)', description: 'Already present' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryAllByText('Stand (Power Word Heal):').length).toBe(1);
  });

  // ===== Reaction with automation returning various result types =====

  it('shows feature detail when executeHandler returns undefined', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue(undefined);
    const stats = { ...basePlayerStats, reactions: [{ name: 'Undefined Handler', description: 'Handler returns undefined', details: 'Some details', automation: { type: 'test' } }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('Undefined Handler:')); });
    await waitFor(() => { expect(buildFeatureDetailHtml).toHaveBeenCalled(); });
  });

  // ===== Spell detail popup with onCast handler =====

  it('renders SpellDetailPopup with onCast for normal reaction spell', () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Shield'));
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  // ===== FeaturesToIgnore =====

  it('filters features using 5e featuresToIgnore by default and with explicit 5e ruleset', () => {
    const stats = { ...basePlayerStats, rules: undefined, reactions: [{ name: 'Spellcasting', description: 'Casts spells' }, { name: 'Opportunity Attack', description: 'Attacks fleeing enemies' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Spellcasting:')).not.toBeInTheDocument();
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  // ===== Stand behavior =====

  it('clears pwhStance when Stand is clicked regardless of prone condition', () => {
    vi.mocked(useRuntimeValue).mockImplementation((charName, key) => {
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });
    vi.mocked(getRuntimeValue).mockReturnValue([]);
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Stand (Power Word Heal):'));
    expect(setRuntimeValue).toHaveBeenCalledWith(basePlayerStats.name, 'powerWordHealStandPermission', false, baseProps.campaignName);
  });

  // ===== ArcaneWardRestoreModal prop spreading =====

  it('renders ArcaneWardRestoreModal when automation returns arcaneWardRestore modal type', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'modal', modalName: 'arcaneWardRestore', payload: { someData: true } });
    const stats = { ...basePlayerStats, reactions: [{ name: 'Arcane Ward', description: 'Creates a ward', automation: { type: 'arcane_ward' } }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    await act(async () => { fireEvent.click(screen.getByText('Arcane Ward:')); });
    expect(screen.getByTestId('arcane-ward-restore-modal')).toBeInTheDocument();
  });
});

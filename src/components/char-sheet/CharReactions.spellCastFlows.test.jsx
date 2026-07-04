// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
  default: function SpellDetailPopup({ spell, onCast }) {
    return (
      <div data-testid="spell-detail-popup">
        <span>{spell?.name}</span>
        {onCast && (
          <button
            data-testid="spell-cast-button"
            onClick={() => onCast(spell, {})}
          >
            Cast
          </button>
        )}
      </div>
    );
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

vi.mock('../../services/automation/handlers/reactions/reactionSpellHandler.js', () => ({
  applyWarCasterReaction: vi.fn(),
}));

import { useRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasAutomation, hasTacticalShift, hasSpeedyOpportunityDisadvantage } from '../../services/combat/automation/automationService.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { executeHandler } from '../../services/automation/index.js';
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { applyWarCasterReaction } from '../../services/automation/handlers/reactions/reactionSpellHandler.js';

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
  vi.mocked(applyWarCasterReaction).mockImplementation(() => ({ ok: true }));
}

describe('CharReactions - Spell Cast Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  // ===== Normal Reaction Spell Cast Flow =====

  it('dismisses spell detail popup when popup overlay is clicked', () => {
    render(<CharReactions {...baseProps} />);
    fireEvent.click(screen.getByText('Shield'));
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('popup-overlay'));
    expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
  });

  // ===== Multiple Casting Time Variants =====

  it('filters spells by all reaction casting time variants', () => {
    const stats = { ...basePlayerStats, spellAbilities: { spells: [
      { name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared' },
      { name: 'Counterspell', casting_time: '1 Reaction', prepared: 'Always' },
      { name: 'Lure', casting_time: 'reaction', prepared: 'Prepared' },
      { name: 'Ward', casting_time: 'Reaction', prepared: 'Always' },
    ] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Shield')).toBeInTheDocument();
    expect(screen.getByText('Counterspell')).toBeInTheDocument();
    expect(screen.getByText('Lure')).toBeInTheDocument();
    expect(screen.getByText('Ward')).toBeInTheDocument();
  });

  // ===== Spell table rendering =====

  it('renders spell table columns with correct type labels, level display, and attack/save columns', () => {
    const stats = { ...basePlayerStats, spellAbilities: { toHit: 6, saveDc: 15, spells: [
      { name: 'Healing Word', casting_time: '1 reaction', range: '60 feet', prepared: 'Prepared', heal_at_slot_level: { 1: '1d4+1' } },
      { name: 'Shield', casting_time: '1 reaction', range: 'Self', prepared: 'Prepared' },
      { name: 'Toll the Dead', casting_time: '1 reaction', range: '60 feet', prepared: 'Prepared', level: 0, damage: { damage_at_character_level: { 1: '1d8' } } },
      { name: 'Protection from Energy', casting_time: '1 reaction', range: 'Contact', prepared: 'Prepared', dc: { dc_type: 'CON' } },
    ] } };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.getByText('Healing')).toBeInTheDocument();
    expect(screen.getAllByText('+6').length).toBeGreaterThan(0);
    expect(screen.getByText('DC 15 CON')).toBeInTheDocument();
    expect(screen.getByText('Cantrip')).toBeInTheDocument();
    expect(screen.getAllByText('Utility').length).toBe(3);
  });

  // ===== Automation popup flows =====

  it('shows reactive spell popup with warnings when automation returns eligibleSpells and hasWarnings', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'popup', payload: { eligibleSpells: [{ name: 'Fireball', isSingleTarget: false }], hasWarnings: true } });
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Reaction Test:')); });
    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    expect(screen.getByText('click to dismiss')).toBeInTheDocument();
    expect(screen.getByText(/Some selected spells target more than one creature/)).toBeInTheDocument();
  });

  it('dismisses reactive spell popup when overlay is clicked', async () => {
    vi.mocked(hasAutomation).mockReturnValue(true);
    vi.mocked(executeHandler).mockResolvedValue({ type: 'popup', payload: { eligibleSpells: [{ name: 'Fireball', isSingleTarget: true }], hasWarnings: false } });
    render(<CharReactions {...baseProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Reaction Test:')); });
    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('popup-overlay'));
    expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
  });

  // ===== 2024 Ruleset featuresToIgnore =====

  it('uses 2024 featuresToIgnore when rules is "2024"', () => {
    const stats = { ...basePlayerStats, rules: '2024', reactions: [{ name: 'Spellcasting', description: 'Casts spells' }, { name: 'Opportunity Attack', description: 'Attacks fleeing enemies' }] };
    render(<CharReactions {...baseProps} playerStats={stats} />);
    expect(screen.queryByText('Spellcasting:')).not.toBeInTheDocument();
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });
});

// @improved-by-ai
/**
 * CharSpells interaction tests: the attack-header roll seam (to-hit math,
 * forced mode, cannotAct gate) and the Prepared-header filter toggle.
 *
 * Deliberately NOT re-tested here (covered by sibling suites):
 * - table structure, sorting, prepared-checkbox toggling, 2024 wizard gating
 *   → CharSpells.Table.test.jsx
 * - effect/duration/casting-time/notes formatting and popup rendering
 *   → CharSpells.Rendering.test.jsx
 * - metamagic / target / restoration popup flows → CharSpells.Popups.*.test.jsx
 * - assertCanAct internals → services/combat/assertCanAct.test.js
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import { mockPlayerStats } from './CharSpells.test-utils.js';

// Hoisted spy so every test observes the exact rollAttack call the
// attack-header click produces (same function object across renders).
const { rollAttack } = vi.hoisted(() => ({ rollAttack: vi.fn() }));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
  // Enforcement off ⇒ assertCanAct takes its deterministic allow fast-path.
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack,
    rollDamage: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  })),
}));

// Metamagic/upcast flows are inert scaffolding in these tests — the cast
// popup that drives them is stubbed, so no flow state is ever reached.
vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({})),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({})),
}));

vi.mock('../../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 3),
  getMaxSorceryPoints: vi.fn(() => 6),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 8, rolls: [4, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 16, rolls: [4, 4, 4, 4], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 24, rolls: [6, 6, 6, 6], modifier: 0 })),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
  getTargetFromAttacker: vi.fn(() => null),
  getAttackerTargetName: vi.fn(() => null),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue({ players: [], placedItems: [] }),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 0 })),
}));

vi.mock('./SpellDetailPopup.jsx', () => ({
  default: function SpellDetailPopup({ spell }) {
    return <div data-testid="spell-detail-popup">{spell?.name}</div>;
  },
}));

vi.mock('./CharSpellSlots.jsx', () => ({
  default: function CharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
  },
}));

vi.mock('../popups/MetamagicPopup.jsx', () => ({
  default: function MetamagicPopup() {
    return <div data-testid="metamagic-popup" />;
  },
}));

vi.mock('../popups/MultiTargetPopup.jsx', () => ({
  default: function MultiTargetPopup() {
    return <div data-testid="multi-target-popup" />;
  },
}));

vi.mock('../popups/MultiTargetCountPopup.jsx', () => ({
  default: function MultiTargetCountPopup() {
    return <div data-testid="aid-target-popup" />;
  },
}));

vi.mock('../popups/TargetWithCheckboxesPopup.jsx', () => ({
  default: function TargetWithCheckboxesPopup() {
    return <div data-testid="greater-restoration-popup" />;
  },
}));

vi.mock('../popups/SingleTargetPopup.jsx', () => ({
  default: function SingleTargetPopup() {
    return <div data-testid="mage-armor-popup" />;
  },
}));

vi.mock('../popups/TargetWithTypePopup.jsx', () => ({
  default: function TargetWithTypePopup() {
    return <div data-testid="protection-from-energy-popup" />;
  },
}));

vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({
  default: function MagicMissileTargetPopup() {
    return <div data-testid="magic-missile-popup" />;
  },
}));

vi.mock('./UpcastPopup.jsx', () => ({
  default: function UpcastPopup() {
    return <div data-testid="upcast-popup" />;
  },
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: function DiceRollResult() {
    return <div data-testid="dice-roll-result" />;
  },
}));

vi.mock('../common/Popup.jsx', () => ({
  default: function Popup({ children }) {
    return <div data-testid="popup">{children}</div>;
  },
}));

const CAMPAIGN = 'test-campaign';

// Spell without damage/healing so it stays in this section (the real
// getExcludedSpellNames routes action damage spells to CharActions).
function makeSpell(overrides = {}) {
  return {
    level: 1,
    casting_time: '1 minute',
    range: 'Self',
    duration: 'Instantaneous',
    components: ['V'],
    prepared: '',
    ...overrides,
  };
}

function renderCharSpells(props = {}) {
  const handleTogglePreparedSpells = vi.fn();
  const utils = render(
    <CharSpells
      playerStats={mockPlayerStats}
      campaignName={CAMPAIGN}
      handleTogglePreparedSpells={handleTogglePreparedSpells}
      {...props}
    />
  );
  return { handleTogglePreparedSpells, ...utils };
}

function renderWithSpells(spells, props = {}) {
  return renderCharSpells({
    ...props,
    playerStats: {
      ...mockPlayerStats,
      spellAbilities: { ...mockPlayerStats.spellAbilities, spells },
    },
  });
}

function clickAttackHeader() {
  fireEvent.click(screen.getByText('Attack (to hit):'));
}

describe('CharSpells - spell attack header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each`
    exhaustionPenalty | conditionAttackMode | expectedToHit | expectedForcedMode
    ${0}              | ${undefined}        | ${5}          | ${undefined}
    ${1}              | ${undefined}        | ${4}          | ${undefined}
    ${0}              | ${'disadvantage'}   | ${5}          | ${'disadvantage'}
    ${2}              | ${'disadvantage'}   | ${3}          | ${'disadvantage'}
  `('clicking Attack rolls once at +$expectedToHit with forcedMode=$expectedForcedMode (exhaustion=$exhaustionPenalty, condition=$conditionAttackMode)',
    ({ exhaustionPenalty, conditionAttackMode, expectedToHit, expectedForcedMode }) => {
      renderCharSpells({ exhaustionPenalty, conditionAttackMode });
      clickAttackHeader();

      expect(rollAttack).toHaveBeenCalledTimes(1);
      expect(rollAttack).toHaveBeenCalledWith(
        'Spell Attack',
        expectedToHit,
        { forcedMode: expectedForcedMode }
      );
      // The bonus shown to the player is the bonus that gets rolled.
      expect(screen.getByText(`+${expectedToHit}`)).toBeInTheDocument();
    });

  it('does not roll the spell attack when cannotAct is set', () => {
    renderCharSpells({ cannotAct: true });
    clickAttackHeader();

    expect(rollAttack).not.toHaveBeenCalled();
  });
});

describe('CharSpells - prepared filter toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function fixtureSpells() {
    return [
      makeSpell({ name: 'Light', level: 0, casting_time: '1 action', prepared: 'Always' }),
      makeSpell({ name: 'Detect Magic', casting_time: '1 action', prepared: 'Prepared' }),
      makeSpell({ name: 'Arcane Lock', level: 2, prepared: '' }),
    ];
  }

  it('shows only Always/Prepared spells after the Prepared header is clicked', () => {
    renderWithSpells(fixtureSpells());
    expect(screen.getByText('Arcane Lock')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('columnheader', { name: 'Prepared' }));

    expect(screen.queryByText('Arcane Lock')).not.toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Detect Magic')).toBeInTheDocument();
  });

  it('restores the full spell list when the Prepared header is clicked again', () => {
    renderWithSpells(fixtureSpells());
    const preparedHeader = screen.getByRole('columnheader', { name: 'Prepared' });

    fireEvent.click(preparedHeader);
    expect(screen.queryByText('Arcane Lock')).not.toBeInTheDocument();

    fireEvent.click(preparedHeader);
    expect(screen.getByText('Arcane Lock')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Detect Magic')).toBeInTheDocument();
  });
});

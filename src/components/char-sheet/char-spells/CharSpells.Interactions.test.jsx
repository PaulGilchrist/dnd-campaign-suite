// @maintained-by-ai
/**
 * CharSpells interaction tests: the attack-header roll seam (to-hit math with
 * exhaustion, forced-mode pass-through, cannotAct gate) and the Prepared-header
 * filter toggle.
 *
 * Deliberately NOT re-tested here (covered by sibling suites):
 * - table structure, sorting, prepared-checkbox toggling, 2024 wizard gating
 *   → CharSpells.Table.test.jsx
 * - effect/duration/casting-time/notes formatting and popup rendering
 *   → CharSpells.Rendering.test.jsx
 * - metamagic / target / restoration popup flows and innate-sorcery advantage
 *   forcedMode → CharSpells.Popups.*.test.jsx
 * - assertCanAct internals → services/combat/assertCanAct.test.js
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import { mockPlayerStats } from './CharSpells.test-utils.js';

// Hoisted spy so every test observes the exact rollAttack call the
// attack-header click produces (same function object across renders).
const { rollAttack } = vi.hoisted(() => ({ rollAttack: vi.fn() }));

// --- seams: deterministic, inert scaffolding — no dice, network, or flows ---
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

vi.mock('../../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({
    resolvePositions: vi.fn(() => Promise.resolve()),
    cachedPosRef: { current: null },
  })),
}));

vi.mock('../../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

// Metamagic/upcast flows are inert scaffolding here — the cast popup that
// drives them is never triggered, so no flow state is ever reached.
vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({})),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({})),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

// Keep the table EXACTLY the fixture: no section routing. Partition logic
// is covered by CharActions tests.
vi.mock('../../../services/ui/spellSectionUtils.js', () => ({
  getExcludedSpellNames: vi.fn(() => new Set()),
  isSpellBreakerBonusActionSpell: vi.fn(() => false),
}));

// --- child components with their own suites: inert stubs ---
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

const CAMPAIGN = 'test-campaign';

function makeSpell(overrides = {}) {
  return {
    level: 1,
    casting_time: '1 action',
    range: 'Self',
    duration: 'Instantaneous',
    components: ['V'],
    prepared: '',
    ...overrides,
  };
}

function renderCharSpells(props = {}) {
  const utils = render(
    <CharSpells
      playerStats={mockPlayerStats}
      campaignName={CAMPAIGN}
      handleTogglePreparedSpells={vi.fn()}
      {...props}
    />
  );
  return utils;
}

function renderWithSpells(spells) {
  return renderCharSpells({
    playerStats: {
      ...mockPlayerStats,
      spellAbilities: { ...mockPlayerStats.spellAbilities, spells },
    },
  });
}

describe('CharSpells - spell attack header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each`
    exhaustionPenalty | conditionAttackMode | expectedToHit | expectedForcedMode
    ${0}              | ${undefined}        | ${5}          | ${undefined}
    ${2}              | ${undefined}        | ${3}          | ${undefined}
    ${1}              | ${'disadvantage'}   | ${4}          | ${'disadvantage'}
  `('clicking Attack rolls once at +$expectedToHit with forcedMode=$expectedForcedMode (exhaustion=$exhaustionPenalty, condition=$conditionAttackMode)',
    ({ exhaustionPenalty, conditionAttackMode, expectedToHit, expectedForcedMode }) => {
      renderCharSpells({ exhaustionPenalty, conditionAttackMode });
      fireEvent.click(screen.getByText('Attack (to hit):'));

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
    fireEvent.click(screen.getByText('Attack (to hit):'));

    expect(rollAttack).not.toHaveBeenCalled();
  });
});

describe('CharSpells - prepared filter toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters to Always/Prepared spells when the Prepared header is clicked, and restores on the next click', () => {
    renderWithSpells([
      makeSpell({ name: 'Light', level: 0, prepared: 'Always' }),
      makeSpell({ name: 'Detect Magic', prepared: 'Prepared' }),
      makeSpell({ name: 'Arcane Lock', level: 2, prepared: '' }),
    ]);
    expect(screen.getByText('Arcane Lock')).toBeInTheDocument();

    const preparedHeader = screen.getByRole('columnheader', { name: 'Prepared' });

    fireEvent.click(preparedHeader);
    expect(screen.queryByText('Arcane Lock')).not.toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Detect Magic')).toBeInTheDocument();

    fireEvent.click(preparedHeader);
    expect(screen.getByText('Arcane Lock')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Detect Magic')).toBeInTheDocument();
  });
});

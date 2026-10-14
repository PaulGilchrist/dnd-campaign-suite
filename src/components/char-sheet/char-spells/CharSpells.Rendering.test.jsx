// @improved-by-ai
/**
 * CharSpells rendering tests: how a spell row READS — effect labels, level,
 * duration/time/notes formatting, the prepared cell, popup-open behaviour on
 * overlay clicks, and the abilities summary values.
 *
 * Deliberately NOT re-tested here (covered by sibling suites):
 * - table headers, sorting, prepared-checkbox toggling, 2024 wizard gating,
 *   empty-list hiding → CharSpells.Table.test.jsx
 * - attack-header roll seam, prepared filter toggle → CharSpells.Interactions.test.jsx
 * - cast routing, metamagic / target-selection / restoration popups
 *   → CharSpells.Popups.*.test.jsx and CharSpells.getTargetInfo.*.test.jsx
 *
 * Notes vs the previous version:
 * - The old vi.mock('../common/Popup.jsx') pointed at a path that does not
 *   exist (the real overlay lives in src/components/common/popup.jsx), so it
 *   never took effect — the overlay-click test always exercised the real
 *   Popup. That dead mock is removed; everything else mocks less.
 * - Cell assertions now locate the named column via its columnheader instead
 *   of scanning all td text with toContain(''), so an empty cell in the WRONG
 *   column can no longer pass the test.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import { mockPlayerStats, mockPlayerStats2024 } from './CharSpells.test-utils.js';
import { isSpellBreakerBonusActionSpell } from '../../../services/ui/spellSectionUtils.js';

const CAMPAIGN = 'test-campaign';

// --- seams: deterministic, inert scaffolding for a pure rendering test ---
// The roll/cast hooks never fire here (no cast clicks in this suite); they
// are stubbed only to keep dice/network code out of the render path.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
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
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({})),
}));

// buildUpcastLevels must be callable: the open SpellDetailPopup receives it.
vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    pendingUpcast: null,
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
  getTargetFromAttacker: vi.fn(() => null),
  getAttackerTargetName: vi.fn(() => null),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => null),
}));

// No spells are routed out of this section, and no Spell Breaker remap.
vi.mock('../../../services/ui/spellSectionUtils.js', () => ({
  getExcludedSpellNames: vi.fn(() => new Set()),
  isSpellBreakerBonusActionSpell: vi.fn(() => false),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

// --- child components with their own suites: replace with inert stubs ---
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

// NOTE: ../common/Popup.jsx is intentionally NOT mocked. The detail popup is
// wrapped by the REAL overlay (src/components/common/popup.jsx) so the
// overlay-click behaviour below tests production wiring.

// --- fixtures ---
function makeSpell(overrides = {}) {
  return {
    name: 'Test Spell',
    level: 1,
    casting_time: '1 action',
    range: 'Self',
    duration: 'Instantaneous',
    components: ['V'],
    prepared: 'Always',
    ...overrides,
  };
}

function renderWithSpells(spells, { stats: statsOverrides = {}, props = {} } = {}) {
  const playerStats = {
    ...mockPlayerStats,
    ...statsOverrides,
    spellAbilities: { ...mockPlayerStats.spellAbilities, spells },
  };
  return render(
    <CharSpells
      playerStats={playerStats}
      campaignName={CAMPAIGN}
      handleTogglePreparedSpells={vi.fn()}
      {...props}
    />
  );
}

/** Render one spell and return the text of the given named column. */
function cellText(spell, header, statsOverrides = {}) {
  renderWithSpells([spell], { stats: statsOverrides });
  return readCell(spell.name, header);
}

function readCell(spellName, header) {
  const headers = screen.getAllByRole('columnheader').map((th) => th.textContent.trim());
  const idx = headers.indexOf(header);
  expect(idx, `column "${header}" should exist`).toBeGreaterThan(-1);
  const row = screen.getAllByRole('row').find((r) => r.cells[0]?.textContent.trim() === spellName);
  expect(row, `row for "${spellName}" should exist`).toBeTruthy();
  return row.cells[idx].textContent;
}

/** Render one spell and return its <td> for the given named column. */
function cellElement(spell, header) {
  renderWithSpells([spell]);
  const headers = screen.getAllByRole('columnheader').map((th) => th.textContent.trim());
  const row = screen.getAllByRole('row').find((r) => r.cells[0]?.textContent.trim() === spell.name);
  return row.cells[headers.indexOf(header)];
}

describe('CharSpells - spell row rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks does not reset implementations; restore the Spell Breaker
    // stub's default in case a test overrode it.
    isSpellBreakerBonusActionSpell.mockImplementation(() => false);
  });

  describe('effect column', () => {
    it.each`
      dc_success   | dcType   | expected
      ${'half'}    | ${'DEX'} | ${'3d8 Cold (DEX half)'}
      ${'negates'} | ${'CON'} | ${'1d6 Cold (CON negates)'}
    `('shows damage with save as "$expected" (save succeeds: $dc_success)', ({ dc_success, dcType, expected }) => {
      const spell = makeSpell({
        damage: {
          damage_at_slot_level: { '2': dc_success === 'half' ? '3d8' : '1d6' },
          damage_type: 'Cold',
        },
        dc: { dc_type: dcType, dc_success },
      });
      expect(cellText(spell, 'Effect')).toBe(expected);
    });

    it('falls back to damage_at_character_level when damage_at_slot_level is absent', () => {
      const spell = makeSpell({
        damage: {
          damage_at_character_level: { '1': '3d6' },
          damage_type: 'Thunder',
        },
      });
      expect(cellText(spell, 'Effect')).toBe('3d6 Thunder');
    });

    it('uses damage_at_character_level when damage_at_slot_level is an empty map', () => {
      const spell = makeSpell({
        damage: {
          damage_at_slot_level: {},
          damage_at_character_level: { '1': '2d6' },
          damage_type: 'Necrotic',
        },
      });
      expect(cellText(spell, 'Effect')).toBe('2d6 Necrotic');
    });

    it.each([undefined, null, {}])('shows Utility when damage is %s', (damage) => {
      expect(cellText(makeSpell({ damage }), 'Effect')).toBe('Utility');
    });

    it.each`
      level | expected
      ${1}  | ${'1d10 Fire'}
      ${5}  | ${'2d10 Fire'}
      ${11} | ${'3d10 Fire'}
      ${17} | ${'4d10 Fire'}
    `('scales cantrip damage at character level $level to $expected', ({ level, expected }) => {
      const cantrip = makeSpell({
        name: 'Fire Bolt',
        level: 0,
        damage: {
          damage_at_slot_level: { '1': '1d10', '5': '2d10', '11': '3d10', '17': '4d10' },
          damage_type: 'Fire',
        },
      });
      expect(cellText(cantrip, 'Effect', { level })).toBe(expected);
    });

    it('falls back to the lowest authored level when the character is below every damage tier', () => {
      const cantrip = makeSpell({
        name: 'Custom Cantrip',
        level: 0,
        damage: {
          damage_at_slot_level: { '5': '2d10', '11': '3d10' },
          damage_type: 'Lightning',
        },
      });
      expect(cellText(cantrip, 'Effect', { level: 0 })).toBe('2d10 Lightning');
    });

    it('shows a Circle of the Land fixed-level spell at its stamped level, not the first damage tier (CLA-050)', () => {
      const spell = makeSpell({
        name: 'Spike Growth',
        level: 3,
        _circleOfTheLandFixedLevel: 3,
        damage: {
          damage_at_slot_level: { '1': '2d8', '3': '3d8' },
          damage_type: 'Piercing',
        },
      });
      expect(cellText(spell, 'Effect', { level: 10 })).toBe('3d8 Piercing');
    });

    it('shows an unstamped spell at its first authored damage tier', () => {
      const spell = makeSpell({
        name: 'Spike Growth',
        level: 3,
        damage: {
          damage_at_slot_level: { '1': '2d8', '3': '3d8' },
          damage_type: 'Piercing',
        },
      });
      expect(cellText(spell, 'Effect', { level: 10 })).toBe('2d8 Piercing');
    });

    it.each`
      className | level | expected
      ${'Ranger'} | ${20} | ${'1d10 Piercing'}
      ${'Ranger'} | ${19} | ${'1d6 Piercing'}
      ${'Rogue'}  | ${20} | ${'1d6 Piercing'}
    `("shows Hunter's Mark as $expected for a level $level $className", ({ className, level, expected }) => {
      const spell = makeSpell({
        name: "Hunter's Mark",
        damage: { damage_at_slot_level: { '1': '1d6' }, damage_type: 'Piercing' },
      });
      expect(cellText(spell, 'Effect', { level, class: { name: className } })).toBe(expected);
    });

    it.each`
      dc_success   | expected
      ${'half'}    | ${'WIS half'}
      ${'negates'} | ${'WIS negates'}
      ${'none'}    | ${'WIS'}
    `('shows DC-only effect as "$expected" (no damage)', ({ dc_success, expected }) => {
      const spell = makeSpell({ dc: { dc_type: 'WIS', dc_success } });
      expect(cellText(spell, 'Effect')).toBe(expected);
    });
  });

  describe('level column', () => {
    it('shows "Cantrip" for level 0 and the numeric level otherwise', () => {
      renderWithSpells([
        makeSpell({ name: 'Light', level: 0 }),
        makeSpell({ name: 'Detect Magic', level: 1 }),
      ]);
      expect(readCell('Light', 'Level')).toBe('Cantrip');
      expect(readCell('Detect Magic', 'Level')).toBe('1');
    });
  });

  describe('duration column', () => {
    it.each`
      duration                             | expected
      ${'1 minute'}                        | ${'1 min'}
      ${'10 minutes'}                      | ${'10 mins'}
      ${'up to 1 hour'}                    | ${'1 hour'}
      ${'1 hour'}                          | ${'1 hour'}
      ${'Instantaneous'}                   | ${'Instant'}
      ${'Concentration, up to 10 minutes'} | ${'Concentration, 10 mins'}
      ${'Concentration, up to 1 hour'}   | ${'Concentration, 1 hour'}
    `('formats duration "$duration" as "$expected"', ({ duration, expected }) => {
      expect(cellText(makeSpell({ duration }), 'Duration')).toBe(expected);
    });

    it.each([null, undefined])('leaves the duration cell empty when duration is %s', (duration) => {
      expect(cellText(makeSpell({ duration }), 'Duration')).toBe('');
    });
  });

  describe('time column', () => {
    it.each`
      casting_time     | pattern
      ${'1 action'}     | ${/^1\s+A$/}
      ${'1 bonus action'} | ${/^1\s+BA$/}
      ${'1 reaction'}   | ${/^1\s+Reaction$/}
      ${'1 minute'}     | ${/^1\s+min$/}
      ${'10 minutes'}   | ${/^10\s+min$/}
      ${'1 turn'}       | ${/^1\s+turn$/}
    `('abbreviates casting time "$casting_time" to $pattern', ({ casting_time, pattern }) => {
      expect(cellText(makeSpell({ casting_time }), 'Time')).toMatch(pattern);
    });

    it('routes Spell Breaker spells through the bonus-action remap in the time column (CLA-322)', () => {
      // The remap replaces the whole casting_time with 'bonus action', which
      // formats to 'BA' (the '1 ' prefix is dropped by current production
      // formatting — tolerated by the optional group so a cosmetic fix there
      // will not break this wiring test).
      isSpellBreakerBonusActionSpell.mockImplementation((_stats, name) => name === 'Dispel Magic');
      const spell = makeSpell({ name: 'Dispel Magic', casting_time: '1 action' });
      expect(cellText(spell, 'Time')).toMatch(/^(1\s+)?BA$/);
      isSpellBreakerBonusActionSpell.mockImplementation(() => false);
    });

    it.each([null, undefined])('leaves the time cell empty when casting_time is %s', (casting_time) => {
      expect(cellText(makeSpell({ casting_time }), 'Time')).toBe('');
    });
  });

  describe('notes column', () => {
    it.each`
      components                      | expected
      ${['V', 'S', 'M']}            | ${'V/S/M'}
      ${['V', 'S']}                 | ${'V/S'}
      ${['V', 'M']}                 | ${'V/M'}
      ${['V', 'Concentration']}     | ${'V/Con'}
      ${['S', 'M', 'Concentration']} | ${'S/M/Con'}
    `('formats components $components as "$expected"', ({ components, expected }) => {
      expect(cellText(makeSpell({ components }), 'Notes')).toBe(expected);
    });

    it.each([[], null, undefined])('leaves the notes cell empty when components is %s', (components) => {
      expect(cellText(makeSpell({ components }), 'Notes')).toBe('');
    });
  });

  describe('prepared column', () => {
    it('renders an unchecked checkbox for an unprepared spell (prepared: "")', () => {
      const cell = cellElement(makeSpell({ prepared: '' }), 'Prepared');
      const checkbox = cell.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
      expect(screen.queryAllByRole('checkbox')).toHaveLength(1);
    });

    it.each(['Always', 'Innate', 'Ritual Only'])('shows the text "%s" without a checkbox', (prepared) => {
      expect(cellText(makeSpell({ prepared }), 'Prepared')).toBe(prepared);
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });
  });

  describe('spell detail popup', () => {
    it('keeps the detail popup open when the overlay backdrop is clicked', () => {
      renderWithSpells([makeSpell({ name: 'Light' })]);

      fireEvent.click(screen.getByText('Light'));
      expect(screen.getByTestId('spell-detail-popup')).toHaveTextContent('Light');

      // The detail popup deliberately hides its own close button; clicking
      // the backdrop of the REAL overlay must not dismiss the spell detail.
      fireEvent.click(screen.getByTestId('popup-overlay'));
      expect(screen.getByTestId('spell-detail-popup')).toHaveTextContent('Light');
    });
  });

  describe('spell abilities summary', () => {
    it('shows cantrip, prepared, and max-prepared counts from spellAbilities', () => {
      renderWithSpells([makeSpell()]);
      const summary = screen.getByText('Cantrips Known:').parentElement;
      expect(summary).toHaveTextContent(/Cantrips Known:\s*3/);
      expect(summary).toHaveTextContent(/Prepared Spells:\s*5/);
      expect(summary).toHaveTextContent(/Max Prepared:\s*5/);
    });

    it('shows "All" for prepared counts when they are not tracked', () => {
      render(<CharSpells
        playerStats={{
          ...mockPlayerStats,
          spellAbilities: {
            toHit: 5,
            modifier: 3,
            saveDc: 13,
            cantrips_known: 2,
            spells: [makeSpell()],
          },
        }}
        campaignName={CAMPAIGN}
        handleTogglePreparedSpells={vi.fn()}
      />);
      const summary = screen.getByText('Cantrips Known:').parentElement;
      expect(summary).toHaveTextContent(/Cantrips Known:\s*2/);
      expect(summary).toHaveTextContent(/Prepared Spells:\s*All/);
      expect(summary).toHaveTextContent(/Max Prepared:\s*All/);
    });

    it('omits the prepared counts for 2024 non-wizards but keeps cantrips known', () => {
      render(<CharSpells
        playerStats={mockPlayerStats2024}
        campaignName={CAMPAIGN}
        handleTogglePreparedSpells={vi.fn()}
      />);
      expect(screen.queryByText(/Prepared Spells:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Max Prepared:/)).not.toBeInTheDocument();
      expect(screen.getByText('Cantrips Known:').parentElement).toHaveTextContent(/Cantrips Known:\s*3/);
    });
  });
});

// @maintained-by-ai
/**
 * CharSpells rendering tests: how a spell row READS — effect labels, level,
 * duration/time/notes formatting, the prepared cell's text variants, the
 * backdrop-click behaviour of the spell detail popup, and the abilities
 * summary values.
 *
 * Deliberately NOT tested here (covered by sibling suites):
 * - table headers, sorting, prepared-checkbox states + toggle notification,
 *   2024 wizard gating, empty-list hiding, popup-opens-on-name-click
 *   → CharSpells.Table.test.jsx
 * - attack-header roll seam, prepared filter toggle → CharSpells.Interactions.test.jsx
 * - cast routing, metamagic / target-selection / restoration popups
 *   → CharSpells.Popups.*.test.jsx and CharSpells.getTargetInfo.*.test.jsx
 *
 * Mocking policy: only hooks/services whose REAL implementations would touch
 * the network or demand unmocked collaborators are stubbed. The popup leaf
 * components (Metamagic, Upcast, target popups…) render nothing unless a
 * pending* prop is set — no cast flow runs in this suite, so they render
 * nothing unmocked too. SpellDetailPopup stays stubbed so its heavy internals
 * (its own suites) stay out; the REAL src/components/common/popup.jsx wraps
 * it, so the backdrop test below exercises production overlay wiring.
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

// No spells are routed out of this section, and no Spell Breaker remap
// (CLA-322 test below overrides the remap stub explicitly).
vi.mock('../../../services/ui/spellSectionUtils.js', () => ({
  getExcludedSpellNames: vi.fn(() => new Set()),
  isSpellBreakerBonusActionSpell: vi.fn(() => false),
}));

// Called on every render; the real one hits the network.
vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
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

// NOTE: src/components/common/popup.jsx is intentionally NOT mocked. The
// detail popup is wrapped by the REAL overlay so the backdrop-click test
// below exercises production wiring.

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

function renderWithSpells(spells, { stats: statsOverrides = {}, abilities = {}, props = {} } = {}) {
  const playerStats = {
    ...mockPlayerStats,
    ...statsOverrides,
    spellAbilities: { ...mockPlayerStats.spellAbilities, ...abilities, spells },
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

    it.each`
      label                | damage                                                                                                        | expected
      ${'absent slot map'} | ${{ damage_at_character_level: { '1': '3d6' }, damage_type: 'Thunder' }}                                | ${'3d6 Thunder'}
      ${'empty slot map'}  | ${{ damage_at_slot_level: {}, damage_at_character_level: { '1': '2d6' }, damage_type: 'Necrotic' }}    | ${'2d6 Necrotic'}
    `('falls back to damage_at_character_level when the slot damage map is $label', ({ damage, expected }) => {
      expect(cellText(makeSpell({ damage }), 'Effect')).toBe(expected);
    });

    it.each([undefined, null, {}])('shows Utility when damage is %s', (damage) => {
      expect(cellText(makeSpell({ damage }), 'Effect')).toBe('Utility');
    });

    it.each([
      { level: 1, ladder: { '1': '1d10', '5': '2d10', '11': '3d10', '17': '4d10' }, type: 'Fire', expected: '1d10 Fire' },
      { level: 5, ladder: { '1': '1d10', '5': '2d10', '11': '3d10', '17': '4d10' }, type: 'Fire', expected: '2d10 Fire' },
      { level: 11, ladder: { '1': '1d10', '5': '2d10', '11': '3d10', '17': '4d10' }, type: 'Fire', expected: '3d10 Fire' },
      { level: 17, ladder: { '1': '1d10', '5': '2d10', '11': '3d10', '17': '4d10' }, type: 'Fire', expected: '4d10 Fire' },
      { level: 0, ladder: { '5': '2d10', '11': '3d10' }, type: 'Lightning', expected: '2d10 Lightning' },
    ])('scales cantrip damage for a character level $level to $expected (ladder $ladder)', ({ level, ladder, type, expected }) => {
      const cantrip = makeSpell({
        name: 'Fire Bolt',
        level: 0,
        damage: { damage_at_slot_level: ladder, damage_type: type },
      });
      expect(cellText(cantrip, 'Effect', { level })).toBe(expected);
    });

    it.each`
      fixedLevel | expected
      ${3}       | ${'3d8 Piercing'}
      ${null}    | ${'2d8 Piercing'}
    `('shows Spike Growth at $expected (Circle of the Land fixed level: $fixedLevel) (CLA-050)', ({ fixedLevel, expected }) => {
      const spell = makeSpell({
        name: 'Spike Growth',
        level: 3,
        ...(fixedLevel != null ? { _circleOfTheLandFixedLevel: fixedLevel } : {}),
        damage: {
          damage_at_slot_level: { '1': '2d8', '3': '3d8' },
          damage_type: 'Piercing',
        },
      });
      expect(cellText(spell, 'Effect', { level: 10 })).toBe(expected);
    });

    it.each`
      className   | level | expected
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
      duration                               | expected
      ${'1 minute'}                        | ${'1 min'}
      ${'10 minutes'}                      | ${'10 mins'}
      ${'up to 1 hour'}                    | ${'1 hour'}
      ${'1 hour'}                          | ${'1 hour'}
      ${'Instantaneous'}                   | ${'Instant'}
      ${'Concentration, up to 10 minutes'} | ${'Concentration, 10 mins'}
      ${'Concentration, up to 1 hour'}   | ${'Concentration, 1 hour'}
      ${null}                              | ${''}
      ${undefined}                         | ${''}
    `('formats duration "$duration" as "$expected"', ({ duration, expected }) => {
      expect(cellText(makeSpell({ duration }), 'Duration')).toBe(expected);
    });
  });

  describe('time column', () => {
    it.each`
      casting_time       | expected
      ${'1 action'}       | ${'1 A'}
      ${'1 bonus action'} | ${'1 BA'}
      ${'1 reaction'}     | ${'1 Reaction'}
      ${'1 minute'}       | ${'1 min'}
      ${'10 minutes'}     | ${'10 min'}
      ${'1 turn'}         | ${'1 turn'}
      ${null}             | ${''}
      ${undefined}        | ${''}
    `('abbreviates casting time "$casting_time" to "$expected"', ({ casting_time, expected }) => {
      // \s+ collapse: production ' A' substitution emits a leading space;
      // spacing is a cosmetic detail, the abbreviation token is the contract.
      expect(cellText(makeSpell({ casting_time }), 'Time').replace(/\s+/g, ' ')).toBe(expected);
    });

    it('routes Spell Breaker spells through the bonus-action remap in the time column (CLA-322)', () => {
      // The remap replaces the whole casting_time with 'bonus action', which
      // formats to 'BA' (the '1 ' prefix is dropped by current production
      // formatting — tolerated by the optional group so a cosmetic fix there
      // will not break this wiring test).
      isSpellBreakerBonusActionSpell.mockImplementation((_stats, name) => name === 'Dispel Magic');
      const spell = makeSpell({ name: 'Dispel Magic', casting_time: '1 action' });
      expect(cellText(spell, 'Time')).toMatch(/^(1\s+)?BA$/);
    });
  });

  describe('notes column', () => {
    it.each`
      components                       | expected
      ${['V', 'S', 'M']}             | ${'V/S/M'}
      ${['V', 'S']}                  | ${'V/S'}
      ${['V', 'M']}                  | ${'V/M'}
      ${['V', 'Concentration']}      | ${'V/Con'}
      ${['S', 'M', 'Concentration']} | ${'S/M/Con'}
      ${[]}                          | ${''}
      ${null}                        | ${''}
      ${undefined}                   | ${''}
    `('formats components $components as "$expected"', ({ components, expected }) => {
      expect(cellText(makeSpell({ components }), 'Notes')).toBe(expected);
    });
  });

  describe('prepared column', () => {
    // Checkbox rendering + click notification live in CharSpells.Table.test.jsx;
    // only the non-checkbox text variants are covered here.
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
    it.each([
      { label: 'tracked counts', abilities: {}, prepared: '5', max: '5' },
      {
        label: '"All" when counts are not tracked',
        abilities: { prepared_spells: undefined, spells_known: undefined, maxPreparedSpells: undefined },
        prepared: 'All',
        max: 'All',
      },
    ])('shows $label from spellAbilities', ({ abilities, prepared, max }) => {
      renderWithSpells([makeSpell()], { abilities });
      const summary = screen.getByText('Cantrips Known:').parentElement;
      expect(summary).toHaveTextContent(/Cantrips Known:\s*3/);
      expect(summary).toHaveTextContent(new RegExp(`Prepared Spells:\\s*${max === 'All' ? 'All' : prepared}`));
      expect(summary).toHaveTextContent(new RegExp(`Max Prepared:\\s*${max}`));
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

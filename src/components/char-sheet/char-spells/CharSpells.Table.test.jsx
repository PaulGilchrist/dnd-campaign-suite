// @maintained-by-ai
/**
 * CharSpells table suite: column structure per ruleset (headers, prepared
 * column presence, checkbox rows mapped to their spell), table hiding,
 * the prepared-checkbox toggle notification, header-driven sorting, and the
 * 2024-wizard castability gating on spell-name clicks.
 *
 * Deliberately NOT re-tested here (covered by sibling suites):
 * - effect/duration/time/notes formatting, prepared-cell text variants,
 *   detail-popup opening on a 5e name click + overlay backdrop behaviour,
 *   abilities summary values
 *   → CharSpells.Rendering.test.jsx
 * - attack-header roll seam and the Prepared-header filter toggle
 *   → CharSpells.Interactions.test.jsx
 * - cast routing, metamagic / target-selection / restoration popups
 *   → CharSpells.Popups.*.test.jsx, CharSpells.getTargetInfo.*.test.jsx
 * - getExcludedSpellNames partition logic itself
 *   → CharActions.elderChampion.test.jsx
 *
 * Mocking policy: the roll/cast hooks never fire here (no cast clicks in
 * this suite); they are stubbed only to keep dice/network code out of the
 * render path. spellSectionUtils is stubbed so table rows come EXACTLY from
 * the fixtures, not from live section-routing fallout.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import { mockPlayerStats } from './CharSpells.test-utils.js';

const CAMPAIGN = 'test-campaign';

// --- seams: deterministic, inert scaffolding — no dice, network, or flows ---
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

vi.mock('../../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({
    resolvePositions: vi.fn(() => Promise.resolve()),
    cachedPosRef: { current: null },
  })),
}));

vi.mock('../../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

// The component destructures many names from this result; all stay undefined
// because no cast flow is ever triggered from this table-only suite.
vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({})),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    pendingUpcast: null,
    buildUpcastLevels: vi.fn(() => []),
    handleUpcastConfirm: vi.fn(),
    handleUpcastCancel: vi.fn(),
  })),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

// Keep the table EXACTLY the fixture: no section routing, no Spell Breaker
// casting-time remap. Partition logic is tested in CharActions tests.
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
    return <div data-testid="char-spell-slots" />;
  },
}));

// --- fixtures ---
function makeSpell(overrides = {}) {
  return {
    name: 'Test Spell',
    level: 1,
    casting_time: '1 action',
    range: 'Self',
    duration: 'Instantaneous',
    components: ['V'],
    prepared: '',
    ...overrides,
  };
}

/**
 * The rows this section renders: one checkbox row (Prepared → checked),
 * one checkbox row (unprepared → unchecked), and two text rows ('Always'
 * renders as text, never a checkbox).
 */
function tableSpells() {
  return [
    makeSpell({ name: 'Fireball', level: 3, prepared: 'Prepared' }),
    makeSpell({ name: 'Shield', casting_time: '1 reaction', prepared: '' }),
    makeSpell({ name: 'Detect Magic', duration: 'Concentration, up to 10 minutes', prepared: 'Always' }),
    makeSpell({ name: 'Light', level: 0, range: 'Touch', duration: '10 minutes', prepared: 'Always' }),
  ];
}

function makeStats(spells, overrides = {}) {
  return {
    ...mockPlayerStats,
    ...overrides,
    spellAbilities: { ...mockPlayerStats.spellAbilities, ...overrides.spellAbilities, spells },
  };
}

const WIZARD_2024 = { rules: '2024', class: { name: 'Wizard' } };
const NON_WIZARD_2024 = { rules: '2024' };

function renderCharSpells(stats, props = {}) {
  const handleTogglePreparedSpells = vi.fn();
  const utils = render(
    <CharSpells
      playerStats={stats}
      campaignName={CAMPAIGN}
      handleTogglePreparedSpells={handleTogglePreparedSpells}
      {...props}
    />
  );
  return { handleTogglePreparedSpells, ...utils };
}

function renderTable(spells, statsOverrides = {}, props = {}) {
  return renderCharSpells(makeStats(spells, statsOverrides), props);
}

function headerLabels() {
  return screen.getAllByRole('columnheader').map((th) => th.textContent.trim());
}

/** Spell names in rendered row order (skips the header row). */
function renderedSpellNames() {
  return screen.getAllByRole('row')
    .filter((row) => row.cells[0]?.tagName === 'TD')
    .map((row) => row.cells[0].textContent.trim());
}

function rowFor(spellName) {
  const row = screen.getAllByRole('row')
    .find((r) => r.cells[0]?.tagName === 'TD' && r.cells[0].textContent.trim() === spellName);
  expect(row, `row for "${spellName}" should exist`).toBeTruthy();
  return row;
}

function checkboxFor(spellName) {
  const idx = headerLabels().indexOf('Prepared');
  expect(idx, 'Prepared column should exist').toBeGreaterThan(-1);
  const box = rowFor(spellName).cells[idx].querySelector('input[type="checkbox"]');
  expect(box, `checkbox for "${spellName}" should exist in its Prepared cell`).toBeTruthy();
  return box;
}

describe('CharSpells - table structure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each`
    label                 | statsOverrides     | showPrepared
    ${'5e'}               | ${{}}              | ${true}
    ${'2024 wizard'}     | ${WIZARD_2024}     | ${true}
    ${'2024 non-wizard'} | ${NON_WIZARD_2024} | ${false}
  `('renders $label headers and prepared column exactly', ({ statsOverrides, showPrepared }) => {
    renderTable(tableSpells(), statsOverrides);

    expect(headerLabels()).toEqual(showPrepared
      ? ['Spell', 'Level', 'Prepared', 'Time', 'Range', 'Effect', 'Duration', 'Notes']
      : ['Spell', 'Level', 'Time', 'Range', 'Effect', 'Duration', 'Notes']);

    // Only 'Prepared'/'' rows get a checkbox, in their own row, checked
    // from data; 'Always' rows render text instead (variants in Rendering).
    expect(screen.queryAllByRole('checkbox')).toHaveLength(showPrepared ? 2 : 0);
    if (showPrepared) {
      expect(checkboxFor('Fireball')).toBeChecked();
      expect(checkboxFor('Shield')).not.toBeChecked();
    }
  });

  it.each`
    label                        | stats                                            | showSummary
    ${'the spell list is empty'}  | ${makeStats([])}                               | ${true}
    ${'spellAbilities is missing'} | ${{ ...mockPlayerStats, spellAbilities: undefined }} | ${false}
  `('renders no table when $label', ({ stats, showSummary }) => {
    renderCharSpells(stats);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // The whole spell block (summary included) vanishes without spellAbilities;
    // an empty list hides only the table.
    expect(!!screen.queryByText('Cantrips Known:')).toBe(showSummary);
  });
});

describe('CharSpells - prepared checkbox seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking a spell\'s checkbox notifies the handler exactly once with that spell name', () => {
    const { handleTogglePreparedSpells } = renderTable([
      makeSpell({ name: 'Fireball', prepared: 'Prepared' }),
      makeSpell({ name: 'Shield', prepared: '' }),
    ]);

    fireEvent.click(checkboxFor('Shield'));

    expect(handleTogglePreparedSpells).toHaveBeenCalledTimes(1);
    expect(handleTogglePreparedSpells).toHaveBeenCalledWith('Shield');
  });
});

describe('CharSpells - header sorting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each`
    header     | spells                                                                                              | expected
    ${'Spell'} | ${[makeSpell({ name: 'Spike Growth', level: 2 }), makeSpell({ name: 'Acid Splash', level: 0 }), makeSpell({ name: 'Blade Ward', level: 0 })]}             | ${['Acid Splash', 'Blade Ward', 'Spike Growth']}
    ${'Level'} | ${[makeSpell({ name: 'Counterspell', level: 3 }), makeSpell({ name: 'Shield', level: 1 }), makeSpell({ name: 'Light', level: 0 }), makeSpell({ name: 'Bless', level: 1 })]} | ${['Light', 'Bless', 'Shield', 'Counterspell']}
  `('sorts rows by $header (then name) when its header is clicked', ({ header, spells, expected }) => {
    renderTable(spells);
    // Fixtures deliberately start unsorted so a no-op click cannot pass.
    const before = renderedSpellNames();
    expect(before).not.toEqual(expected);

    fireEvent.click(screen.getByRole('columnheader', { name: header }));

    expect(renderedSpellNames()).toEqual(expected);
  });
});

describe('CharSpells - 2024 wizard castability gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each`
    spellName       | ritual   | opens
    ${'Shield'}     | ${false} | ${false}
    ${'Detect Magic'} | ${true} | ${true}
    ${'Fireball'}   | ${false} | ${true}
  `('unprepared $spellName (ritual: $ritual) opens detail: $opens',
    ({ spellName, ritual, opens }) => {
      renderTable([
        makeSpell({ name: 'Fireball', level: 3, prepared: 'Prepared' }),
        makeSpell({ name: 'Shield', prepared: '', ritual }),
        makeSpell({ name: 'Detect Magic', duration: 'Concentration, up to 10 minutes', prepared: '', ritual }),
      ], WIZARD_2024);

      fireEvent.click(screen.getByText(spellName));

      const popup = screen.queryByTestId('spell-detail-popup');
      if (opens) {
        expect(popup).toBeInTheDocument();
        expect(popup).toHaveTextContent(spellName);
      } else {
        expect(popup).not.toBeInTheDocument();
        expect(screen.getByText(spellName)).toHaveAttribute('title', 'Not prepared');
      }
    });
});

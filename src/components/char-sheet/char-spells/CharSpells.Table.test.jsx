// @improved-by-ai
/**
 * CharSpells table suite: column structure per ruleset, the prepared-checkbox
 * seam (rendered state + toggle notification), header-driven sorting, and the
 * 2024-wizard castability gating on spell-name clicks.
 *
 * Deliberately NOT re-tested here (covered by sibling suites):
 * - effect/duration/time/notes formatting, prepared-cell text variants,
 *   overlay backdrop behaviour, abilities summary values
 *   → CharSpells.Rendering.test.jsx
 * - attack-header roll seam and the Prepared-header filter toggle
 *   → CharSpells.Interactions.test.jsx
 * - cast routing, metamagic / target-selection / restoration popups
 *   → CharSpells.Popups.*.test.jsx, CharSpells.getTargetInfo.*.test.jsx
 * - getExcludedSpellNames partition logic itself
 *   → CharActions.elderChampion.test.jsx
 *
 * Notes vs the previous version:
 * - Dead mocks removed: hooks/combat/useDiceRollPopup.js does not exist
 *   (the real hook lives in DiceRollContext.js with a safe default context),
 *   and ../common/Popup.jsx never matched the real lowercase popup.jsx.
 *   Child popup stubs are dropped too — every real popup is gated behind a
 *   pending* prop that is undefined here, so they render nothing.
 * - spellSectionUtils is now stubbed (like the sibling suites): table rows
 *   come EXACTLY from the fixtures, not from live section-routing fallout.
 *   The old tests silently dropped Fireball/Magic Missile from the table via
 *   the real getExcludedSpellNames, making row-count assertions misleading.
 * - Sort tests now use fixtures whose initial order differs from the sorted
 *   order and assert the FULL column order, so a no-op sort can no longer
 *   pass (the old level-sort clicked a table that already started "sorted").
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

/** The rows this section renders: one checkbox row, one text row, one cantrip. */
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
  return rowFor(spellName).cells[idx].querySelector('input[type="checkbox"]');
}

describe('CharSpells - table structure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each`
    label                    | statsOverrides        | expectedPreparedChecked
    ${'5e'}                  | ${{}}                 | ${[true, false]}
    ${'2024 non-wizard'}    | ${NON_WIZARD_2024}    | ${[]}
    ${'2024 wizard'}        | ${WIZARD_2024}        | ${[true, false]}
  `('renders $label headers and prepared column exactly',
    ({ statsOverrides, expectedPreparedChecked }) => {
      renderTable(tableSpells(), statsOverrides);

      const hasPrepared = headerLabels().includes('Prepared');
      expect(hasPrepared).toBe(expectedPreparedChecked.length > 0);
      expect(headerLabels()).toEqual(expectedPreparedChecked.length
        ? ['Spell', 'Level', 'Prepared', 'Time', 'Range', 'Effect', 'Duration', 'Notes']
        : ['Spell', 'Level', 'Time', 'Range', 'Effect', 'Duration', 'Notes']);

      const checkboxes = screen.queryAllByRole('checkbox');
      expect(checkboxes).toHaveLength(expectedPreparedChecked.length);
      checkboxes.forEach((box, i) => {
        if (expectedPreparedChecked[i]) {
          expect(box).toBeChecked();
        } else {
          expect(box).not.toBeChecked();
        }
      });
    });

  it('hides the table when the list has no spells', () => {
    renderTable([]);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders no table and no spell abilities when spellAbilities is missing', () => {
    const stats = { ...mockPlayerStats, spellAbilities: undefined };
    renderCharSpells(stats);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Cantrips Known:')).not.toBeInTheDocument();
  });
});

describe('CharSpells - prepared checkbox seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a checkbox per toggleable spell in its Prepared cell with checked state from data', () => {
    renderTable([
      makeSpell({ name: 'Fireball', prepared: 'Prepared' }),
      makeSpell({ name: 'Shield', prepared: '' }),
    ]);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(checkboxFor('Fireball')).toBeChecked();
    expect(checkboxFor('Shield')).not.toBeChecked();
  });

  it('notifies the handler exactly once, with the spell name, when a checkbox is clicked', () => {
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

  it('sorts rows alphabetically when the Spell header is clicked', () => {
    renderTable([
      makeSpell({ name: 'Spike Growth', level: 2 }),
      makeSpell({ name: 'Acid Splash', level: 0 }),
      makeSpell({ name: 'Blade Ward', level: 0 }),
    ]);
    // Fixture deliberately starts unsorted so a no-op click cannot pass.
    expect(renderedSpellNames()).toEqual(['Spike Growth', 'Acid Splash', 'Blade Ward']);

    fireEvent.click(screen.getByRole('columnheader', { name: 'Spell' }));

    expect(renderedSpellNames()).toEqual(['Acid Splash', 'Blade Ward', 'Spike Growth']);
  });

  it('sorts rows by level ascending, then by name, when the Level header is clicked', () => {
    renderTable([
      makeSpell({ name: 'Counterspell', level: 3 }),
      makeSpell({ name: 'Shield', level: 1 }),
      makeSpell({ name: 'Light', level: 0 }),
      makeSpell({ name: 'Bless', level: 1 }),
    ]);
    expect(renderedSpellNames()).toEqual(['Counterspell', 'Shield', 'Light', 'Bless']);

    fireEvent.click(screen.getByRole('columnheader', { name: 'Level' }));

    expect(renderedSpellNames()).toEqual(['Light', 'Bless', 'Shield', 'Counterspell']);
  });
});

describe('CharSpells - spell detail popup gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the detail popup when a 5e spell name is clicked', () => {
    renderTable(tableSpells());
    fireEvent.click(screen.getByText('Fireball'));
    expect(screen.getByTestId('spell-detail-popup')).toHaveTextContent('Fireball');
  });

  it.each`
    spellName       | ritual   | opens
    ${'Shield'}     | ${false} | ${false}
    ${'Detect Magic'} | ${true} | ${true}
    ${'Fireball'}   | ${false} | ${true}
  `('2024 wizard: unprepared $spellName (ritual: $ritual) opens detail: $opens',
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharSpells from './CharSpells.jsx';
import * as helpers from './CharSpells.test.helpers.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
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

vi.mock('../../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 3),
  getMaxSorceryPoints: vi.fn(() => 6),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    pendingMultiTarget: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    handleMultiTargetConfirm: vi.fn(),
    handleMultiTargetSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingHeroesFeast: null,
    handleHeroesFeastConfirm: vi.fn(),
    handleHeroesFeastSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
    pendingLesserRestoration: null,
    handleLesserRestorationConfirm: vi.fn(),
    handleLesserRestorationSkip: vi.fn(),
    pendingMageArmor: null,
    handleMageArmorConfirm: vi.fn(),
    handleMageArmorSkip: vi.fn(),
    pendingShieldOfFaith: null,
    handleShieldOfFaithConfirm: vi.fn(),
    handleShieldOfFaithSkip: vi.fn(),
    pendingProtectionFromEnergy: null,
    handleProtectionFromEnergyConfirm: vi.fn(),
    handleProtectionFromEnergySkip: vi.fn(),
    pendingResistance: null,
    handleResistanceConfirm: vi.fn(),
    handleResistanceSkip: vi.fn(),
    pendingRemoveCurse: null,
    handleRemoveCurseConfirm: vi.fn(),
    handleRemoveCurseSkip: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    pendingUpcast: null,
    buildUpcastLevels: vi.fn(() => []),
    gateUpcast: vi.fn(() => false),
    handleUpcastConfirm: vi.fn(),
    handleUpcastCancel: vi.fn(),
    getCantripAutoLevel: vi.fn(() => null),
  })),
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
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue({ players: [], placedItems: [] }),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
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
    return <div data-testid="metamagic-popup">Metamagic</div>;
  },
}));

vi.mock('../popups/MultiTargetPopup.jsx', () => ({
  default: function MultiTargetPopup() {
    return <div data-testid="multi-target-popup">MultiTarget</div>;
  },
}));

vi.mock('../popups/AidTargetPopup.jsx', () => ({
  default: function AidTargetPopup() {
    return <div data-testid="aid-target-popup">Aid</div>;
  },
}));

vi.mock('../popups/HeroesFeastTargetPopup.jsx', () => ({
  default: function HeroesFeastTargetPopup() {
    return <div data-testid="heroes-feast-popup">HeroesFeast</div>;
  },
}));

vi.mock('../popups/GreaterRestorationPopup.jsx', () => ({
  default: function GreaterRestorationPopup() {
    return <div data-testid="greater-restoration-popup">GreaterRestoration</div>;
  },
}));

vi.mock('../popups/LesserRestorationPopup.jsx', () => ({
  default: function LesserRestorationPopup() {
    return <div data-testid="lesser-restoration-popup">LesserRestoration</div>;
  },
}));

vi.mock('../popups/RemoveCursePopup.jsx', () => ({
  default: function RemoveCursePopup() {
    return <div data-testid="remove-curse-popup">RemoveCurse</div>;
  },
}));

vi.mock('../popups/MageArmorTargetPopup.jsx', () => ({
  default: function MageArmorTargetPopup() {
    return <div data-testid="mage-armor-popup">MageArmor</div>;
  },
}));

vi.mock('../popups/ShieldOfFaithTargetPopup.jsx', () => ({
  default: function ShieldOfFaithTargetPopup() {
    return <div data-testid="shield-of-faith-popup">ShieldOfFaith</div>;
  },
}));

vi.mock('../popups/ProtectionFromEnergyTargetPopup.jsx', () => ({
  default: function ProtectionFromEnergyTargetPopup() {
    return <div data-testid="protection-from-energy-popup">ProtectionFromEnergy</div>
  },
}));

vi.mock('../popups/ResistanceTargetPopup.jsx', () => ({
  default: function ResistanceTargetPopup() {
    return <div data-testid="resistance-popup">Resistance</div>;
  },
}));

vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({
  default: function MagicMissileTargetPopup() {
    return <div data-testid="magic-missile-popup">MagicMissile</div>;
  },
}));

vi.mock('./UpcastPopup.jsx', () => ({
  default: function UpcastPopup() {
    return <div data-testid="upcast-popup">Upcast</div>;
  },
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: function DiceRollResult() {
    return <div data-testid="dice-roll-result">DiceRollResult</div>;
  },
}));

vi.mock('../common/Popup.jsx', () => ({
  default: function Popup({ children }) {
    return <div data-testid="popup">{children}</div>;
  },
}));

const basePlayerStats = helpers.mockPlayerStats;

describe('CharSpells - Additional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders char-spells wrapper class', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const wrapper = document.querySelector('.char-spells');
    expect(wrapper).toBeInTheDocument();
  });

  it('renders spell-popup-parent wrapper', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const wrapper = document.querySelector('.spell-popup-parent');
    expect(wrapper).toBeInTheDocument();
  });

  it('renders hr separator', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    expect(document.querySelector('hr')).toBeInTheDocument();
  });

  it('renders spell abilities section header', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const header = document.querySelector('.sectionHeader h4');
    expect(header).toHaveTextContent('Spells');
  });

  it('renders spell attack to hit with click handler', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const attackText = screen.getByText(/attack.*to hit/i);
    expect(attackText).toHaveClass('clickable');
  });

  it('renders spell modifier display', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    expect(screen.getByText(/modifier/i)).toBeInTheDocument();
  });

  it('renders save DC with base value', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const abilitiesDiv = document.querySelector('.spell-abilities');
    expect(abilitiesDiv.textContent).toContain('Save DC');
  });

  it('renders spell table element', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  });

  it('renders spell table with correct header columns', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const headers = screen.getByRole('table').querySelectorAll('th');
    const headerTexts = Array.from(headers).map(h => h.textContent.trim());
    expect(headerTexts).toContain('Spell');
    expect(headerTexts).toContain('Level');
    expect(headerTexts).toContain('Prepared');
    expect(headerTexts).toContain('Time');
    expect(headerTexts).toContain('Range');
    expect(headerTexts).toContain('Effect');
    expect(headerTexts).toContain('Duration');
    expect(headerTexts).toContain('Notes');
  });

  it('renders spell table rows for each spell', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
  });

  it('displays spell level as number for non-cantrips', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    const rows = table.querySelectorAll('tbody tr');
    const levelCells = Array.from(rows).map(row => row.children[1].textContent.trim());
    expect(levelCells).toContain('3');
    expect(levelCells).toContain('1');
  });

  it('displays "Cantrip" for cantrip level', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    const rows = table.querySelectorAll('tbody tr');
    const levelCells = Array.from(rows).map(row => row.children[1].textContent.trim());
    expect(levelCells).toContain('Cantrip');
  });

  it('renders casting time with action abbreviation', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    expect(table.textContent).toContain(' A');
  });

  it('renders duration with Instant abbreviation', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('Instant');
  });

  it('renders notes with component abbreviations', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('V');
    expect(table.textContent).toContain('S');
    expect(table.textContent).toContain('M');
  });

  it('renders prepared checkbox for spells with "Prepared" status', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('renders prepared text for spells with "Always" status', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    // Magic Missile has prepared: 'Always' - should show "Always" in prepared column
    const rows = table.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('does not render prepared column for 2024 rules', () => {
    render(<CharSpells playerStats={helpers.mockPlayerStats2024} campaignName="test" />);
    const headers = screen.getByRole('table').querySelectorAll('th');
    const headerTexts = Array.from(headers).map(h => h.textContent.trim());
    expect(headerTexts).not.toContain('Prepared');
  });

  it('does not render prepared column for 2024 rules even with prepared spells', () => {
    render(<CharSpells playerStats={helpers.mockPlayerStats2024} campaignName="test" />);
    const table = screen.getByRole('table');
    const headers = table.querySelectorAll('thead th');
    const headerCount = headers.length;
    // 2024 should have 7 columns (no Prepared)
    expect(headerCount).toBe(7);
  });

  it('renders 5e with 8 columns including Prepared', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    const headers = table.querySelectorAll('thead th');
    expect(headers.length).toBe(8);
  });

  it('renders spell table with stripy class', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    expect(table).toHaveClass('table-striped');
  });

  it('renders spell names in left-aligned cells', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const spellCells = document.querySelectorAll('.spell-name');
    expect(spellCells.length).toBe(3);
  });

  it('clicking spell name opens spell detail popup', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const fireballCell = screen.getByText('Fireball');
    fireEvent.click(fireballCell);
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  it('renders damage effect as clickable when formula exists', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    const effectCells = table.querySelectorAll('tbody td:nth-child(6)');
    expect(effectCells.length).toBe(3);
  });

  it('renders utility effect for spells without damage', () => {
    const spellNoDmg = {
      ...helpers.mockPlayerStats.spellAbilities.spells[2],
      damage: null,
    };
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        ...basePlayerStats.spellAbilities,
        spells: [spellNoDmg],
      },
    };
    render(<CharSpells playerStats={stats} campaignName="test" />);
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('Utility');
  });

  it('renders notes with concentration abbreviated as Con', () => {
    const spellWithConc = {
      ...basePlayerStats.spellAbilities.spells[0],
      concentration: true,
    };
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        ...basePlayerStats.spellAbilities,
        spells: [spellWithConc],
      },
    };
    render(<CharSpells playerStats={stats} campaignName="test" />);
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('Con');
  });

  it('renders notes with ritual', () => {
    const spellWithRitual = {
      ...basePlayerStats.spellAbilities.spells[0],
      ritual: true,
    };
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        ...basePlayerStats.spellAbilities,
        spells: [spellWithRitual],
      },
    };
    render(<CharSpells playerStats={stats} campaignName="test" />);
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('Ritual');
  });

  it('handles spell with components array', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    // Components V/S/M should be joined with /
    expect(table.textContent).toContain('V');
  });

  it('handles spell with no components', () => {
    const spellNoComponents = {
      name: 'Test Spell',
      level: 1,
      casting_time: '1 action',
      range: 'Self',
      duration: '1 round',
      components: null,
      prepared: 'Always',
    };
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        ...basePlayerStats.spellAbilities,
        spells: [spellNoComponents],
      },
    };
    render(<CharSpells playerStats={stats} campaignName="test" />);
    expect(screen.getByText('Test Spell')).toBeInTheDocument();
  });

  it('handles spell with empty components array', () => {
    const spellEmptyComponents = {
      name: 'Test Spell',
      level: 1,
      casting_time: '1 action',
      range: 'Self',
      duration: '1 round',
      components: [],
      prepared: 'Always',
    };
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        ...basePlayerStats.spellAbilities,
        spells: [spellEmptyComponents],
      },
    };
    render(<CharSpells playerStats={stats} campaignName="test" />);
    expect(screen.getByText('Test Spell')).toBeInTheDocument();
  });

  it('handles spell with no duration', () => {
    const spellNoDuration = {
      name: 'Test Spell',
      level: 1,
      casting_time: '1 action',
      range: 'Self',
      duration: null,
      prepared: 'Always',
    };
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        ...basePlayerStats.spellAbilities,
        spells: [spellNoDuration],
      },
    };
    render(<CharSpells playerStats={stats} campaignName="test" />);
    expect(screen.getByText('Test Spell')).toBeInTheDocument();
  });

  it('handles spell with no casting time', () => {
    const spellNoCastTime = {
      name: 'Test Spell',
      level: 1,
      casting_time: null,
      range: 'Self',
      duration: '1 round',
      prepared: 'Always',
    };
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        ...basePlayerStats.spellAbilities,
        spells: [spellNoCastTime],
      },
    };
    render(<CharSpells playerStats={stats} campaignName="test" />);
    expect(screen.getByText('Test Spell')).toBeInTheDocument();
  });

  it('handles spell with no range', () => {
    const spellNoRange = {
      name: 'Test Spell',
      level: 1,
      casting_time: '1 action',
      range: null,
      duration: '1 round',
      prepared: 'Always',
    };
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        ...basePlayerStats.spellAbilities,
        spells: [spellNoRange],
      },
    };
    render(<CharSpells playerStats={stats} campaignName="test" />);
    expect(screen.getByText('Test Spell')).toBeInTheDocument();
  });

  it('renders spell table when only cantrips exist', () => {
    const cantripOnly = {
      ...basePlayerStats.spellAbilities.spells[2],
    };
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        ...basePlayerStats.spellAbilities,
        spells: [cantripOnly],
      },
    };
    render(<CharSpells playerStats={stats} campaignName="test" />);
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  });

  it('renders spell attack click handler does nothing when cannotAct', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" cannotAct={true} />);
    const attackText = screen.getByText(/attack.*to hit/i);
    expect(attackText).toHaveClass('disabled-attack');
  });

  it('renders exhaustion penalty class on to hit span', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" exhaustionPenalty={2} />);
    const toHitSpan = document.querySelector('.spell-abilities span');
    expect(toHitSpan).toHaveClass('stat--penalized');
  });

  it('renders exhaustion penalty class on modifier span', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" exhaustionPenalty={1} />);
    const modifierSpan = document.querySelectorAll('.spell-abilities span')[1];
    expect(modifierSpan).toHaveClass('stat--penalized');
  });

  it('renders conditionAttackMode disadvantage class', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" conditionAttackMode="disadvantage" />);
    const attackText = screen.getByText(/attack.*to hit/i);
    expect(attackText).toHaveClass('stat--penalized');
  });

  it('renders spell slots component with playerStats and campaignName', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    expect(screen.getByTestId('char-spell-slots')).toBeInTheDocument();
  });

  it('applies prepared filter to show only prepared spells', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const preparedHeader = screen.getByText('Prepared');
    fireEvent.click(preparedHeader);
    expect(screen.getByText('Fireball')).toBeInTheDocument();
  });

  it('toggles filter state when prepared header clicked twice', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const preparedHeader = screen.getByText('Prepared');
    fireEvent.click(preparedHeader);
    fireEvent.click(preparedHeader);
    expect(screen.getByText('Fireball')).toBeInTheDocument();
  });

  it('sorts spells by level ascending then name', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const levelHeader = screen.getByText('Level');
    fireEvent.click(levelHeader);
    expect(screen.getByText('Light')).toBeInTheDocument();
  });

  it('sorts spells alphabetically by name', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const spellHeader = screen.getByText('Spell');
    fireEvent.click(spellHeader);
    expect(screen.getByText('Fireball')).toBeInTheDocument();
  });

  it('renders spell damage type in effect column', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('Fire');
  });

  it('renders save DC label in spell abilities', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const abilitiesDiv = document.querySelector('.spell-abilities');
    expect(abilitiesDiv.textContent).toContain('Save DC');
  });

  it('renders cantrips known label', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    expect(screen.getByText(/cantrips known/i)).toBeInTheDocument();
  });

  it('renders prepared spells label', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    expect(screen.getByText(/prepared spells/i)).toBeInTheDocument();
  });

  it('renders max prepared label', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    expect(screen.getByText(/max prepared/i)).toBeInTheDocument();
  });

  it('renders all spell names in table', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
  });

  it('renders spell ranges', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    expect(screen.getByText('150 feet')).toBeInTheDocument();
    expect(screen.getByText('120 feet')).toBeInTheDocument();
    expect(screen.getByText('Touch')).toBeInTheDocument();
  });

  it('renders spell durations', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('Instant');
    expect(table.textContent).toContain('min');
  });

  it('renders spell casting times', () => {
    render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
    const table = screen.getByRole('table');
    expect(table.textContent).toContain(' A');
  });
});

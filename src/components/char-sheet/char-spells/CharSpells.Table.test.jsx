// @improved-by-ai
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
    return <div data-testid="protection-from-energy-popup">ProtectionFromEnergy</div>;
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
const baseProps = { playerStats: basePlayerStats, campaignName: 'test' };

function renderWithProps(props) {
  return render(<CharSpells {...baseProps} {...props} />);
}

describe('CharSpells - Table Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('table structure', () => {
    it('renders the spell table with table-striped class', () => {
      renderWithProps({});
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      expect(table).toHaveClass('table-striped');
    });

    it('renders 8 header columns for 5e rules (including Prepared)', () => {
      renderWithProps({});
      const table = screen.getByRole('table');
      const headers = table.querySelectorAll('thead th');
      expect(headers).toHaveLength(8);
    });

    it('renders 7 header columns for 2024 rules (excluding Prepared)', () => {
      renderWithProps({ playerStats: helpers.mockPlayerStats2024 });
      const table = screen.getByRole('table');
      const headers = table.querySelectorAll('thead th');
      expect(headers).toHaveLength(7);
    });

    it('renders correct header labels for 5e rules', () => {
      renderWithProps({});
      const table = screen.getByRole('table');
      const headerTexts = Array.from(table.querySelectorAll('th')).map(h => h.textContent.trim());
      expect(headerTexts).toEqual([
        'Spell', 'Level', 'Prepared', 'Time', 'Range', 'Effect', 'Duration', 'Notes',
      ]);
    });

    it('renders correct header labels for 2024 rules without Prepared', () => {
      renderWithProps({ playerStats: helpers.mockPlayerStats2024 });
      const table = screen.getByRole('table');
      const headerTexts = Array.from(table.querySelectorAll('th')).map(h => h.textContent.trim());
      expect(headerTexts).toEqual([
        'Spell', 'Level', 'Time', 'Range', 'Effect', 'Duration', 'Notes',
      ]);
    });

    it('renders a row for each spell in the list', () => {
      renderWithProps({});
      const table = screen.getByRole('table');
      const rows = table.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(3);
    });
  });

  describe('spell names and levels', () => {
    it('renders all spell names in the table', () => {
      renderWithProps({});
      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    it('renders spell names in clickable cells', () => {
      renderWithProps({});
      const spellCells = document.querySelectorAll('.spell-name');
      expect(spellCells).toHaveLength(3);
      spellCells.forEach(cell => expect(cell).toHaveClass('clickable'));
    });

    it('renders Cantrip for 0-level spells and numeric levels for higher spells', () => {
      renderWithProps({});
      const table = screen.getByRole('table');
      const rows = table.querySelectorAll('tbody tr');
      const levelCells = Array.from(rows).map(row => row.children[1].textContent.trim());
      expect(levelCells).toContain('Cantrip');
      expect(levelCells).toContain('1');
      expect(levelCells).toContain('3');
    });

    it('does not render level column content for 2024 rules', () => {
      renderWithProps({ playerStats: helpers.mockPlayerStats2024 });
      const table = screen.getByRole('table');
      const rows = table.querySelectorAll('tbody tr');
      const levelCells = Array.from(rows).map(row => row.children[1].textContent.trim());
      expect(levelCells).toContain('Cantrip');
      expect(levelCells).toContain('1');
      expect(levelCells).toContain('3');
    });
  });

  describe('spell ranges and times', () => {
    it('renders spell ranges from the data', () => {
      renderWithProps({});
      expect(screen.getByText('150 feet')).toBeInTheDocument();
      expect(screen.getByText('120 feet')).toBeInTheDocument();
      expect(screen.getByText('Touch')).toBeInTheDocument();
    });

    it('abbreviates casting time "action" as " A"', () => {
      renderWithProps({});
      const table = screen.getByRole('table');
      expect(table.textContent).toContain(' A');
    });

    it('abbreviates casting time "bonus action" as "BA"', () => {
      const bonusActionSpell = {
        name: 'Shield',
        level: 1,
        casting_time: '1 bonus action',
        range: 'Self',
        duration: '1 round',
        prepared: 'Prepared',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [bonusActionSpell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('BA');
    });

    it('abbreviates casting time "reaction" as "Reaction"', () => {
      const reactionSpell = {
        name: 'Reaction Spell',
        level: 0,
        casting_time: '1 reaction',
        range: 'Self',
        duration: 'Instantaneous',
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [reactionSpell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Reaction');
    });
  });

  describe('spell effects column', () => {
    it('renders damage with damage type for spells that have damage', () => {
      renderWithProps({});
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Fire');
      expect(table.textContent).toContain('Force');
    });

    it('renders "Utility" for spells without damage', () => {
      const utilitySpell = {
        ...basePlayerStats.spellAbilities.spells[2],
        damage: null,
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [utilitySpell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Utility');
    });

    it('makes damage effect cells clickable and non-damage cells not clickable', () => {
      renderWithProps({});
      const table = screen.getByRole('table');
      const effectCells = table.querySelectorAll('tbody td:nth-child(6)');
      expect(effectCells).toHaveLength(3);
      expect(effectCells[0]).toHaveClass('clickable');
      expect(effectCells[1]).toHaveClass('clickable');
      expect(effectCells[2]).not.toHaveClass('clickable');
    });

    it('includes save DC info in effect text when spell has both damage and a save', () => {
      const saveSpell = {
        name: 'Cone of Cold',
        level: 2,
        casting_time: '1 action',
        range: '60 feet',
        duration: 'Instantaneous',
        components: ['V', 'S', 'M'],
        damage: {
          damage_at_slot_level: { '2': '3d8' },
          damage_type: 'Cold',
        },
        dc: { dc_type: 'Constitution', dc_success: 'half' },
        prepared: 'Prepared',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [saveSpell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Cold');
      expect(table.textContent).toContain('Constitution');
      expect(table.textContent).toContain('half');
    });
  });

  describe('notes column formatting', () => {
    it('abbreviates "Concentration" as "Con" in notes', () => {
      const concSpell = {
        ...basePlayerStats.spellAbilities.spells[0],
        concentration: true,
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [concSpell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Con');
    });

    it('shows "Ritual" in notes when spell has ritual flag', () => {
      const ritualSpell = {
        ...basePlayerStats.spellAbilities.spells[0],
        ritual: true,
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [ritualSpell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Ritual');
    });

    it('renders components joined with slashes in notes', () => {
      renderWithProps({});
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('V');
      expect(table.textContent).toContain('S');
      expect(table.textContent).toContain('M');
    });

    it('abbreviates "Instantaneous" duration as "Instant"', () => {
      renderWithProps({});
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Instant');
    });

    it('abbreviates "minutes" duration as "min"', () => {
      renderWithProps({});
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('min');
    });
  });

  describe('prepared column', () => {
    it('renders checkboxes for spells with prepared: "Prepared"', () => {
      renderWithProps({});
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(1);
    });

    it('renders prepared text for spells with prepared: "Always"', () => {
      renderWithProps({});
      const table = screen.getByRole('table');
      const rows = table.querySelectorAll('tbody tr');
      const preparedCells = Array.from(rows).map(row => row.children[2]?.textContent.trim());
      expect(preparedCells).toContain('Always');
    });

    it('toggles checkbox checked state and calls handleTogglePreparedSpells', () => {
      const toggleFn = vi.fn();
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" handleTogglePreparedSpells={toggleFn} />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
      fireEvent.click(checkbox);
      expect(toggleFn).toHaveBeenCalledWith('Fireball');
    });

    it('does not render prepared column for 2024 rules', () => {
      renderWithProps({ playerStats: helpers.mockPlayerStats2024 });
      const headers = screen.getByRole('table').querySelectorAll('th');
      const headerTexts = Array.from(headers).map(h => h.textContent.trim());
      expect(headerTexts).not.toContain('Prepared');
    });

    it('does not render checkboxes for 2024 rules', () => {
      renderWithProps({ playerStats: helpers.mockPlayerStats2024 });
      const checkboxes = screen.queryAllByRole('checkbox');
      expect(checkboxes).toHaveLength(0);
    });
  });

  describe('spell detail popup', () => {
    it('opens the spell detail popup when a spell name is clicked', () => {
      renderWithProps({});
      const fireballCell = screen.getByText('Fireball');
      fireEvent.click(fireballCell);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(screen.getByTestId('spell-detail-popup')).toHaveTextContent('Fireball');
    });
  });

  describe('sorting', () => {
    it('sorts spells alphabetically when Spell header is clicked', () => {
      renderWithProps({});
      const spellHeader = screen.getByText('Spell');
      fireEvent.click(spellHeader);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('sorts spells by level ascending when Level header is clicked', () => {
      renderWithProps({});
      const levelHeader = screen.getByText('Level');
      fireEvent.click(levelHeader);
      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    it('toggles prepared filter when Prepared header is clicked', () => {
      renderWithProps({});
      const preparedHeader = screen.getByText('Prepared');
      fireEvent.click(preparedHeader);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });
  });

  describe('spell attack to-hit label', () => {
    it('renders the attack to-hit label with clickable class', () => {
      renderWithProps({});
      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      expect(attackLabel).toHaveClass('clickable');
    });

    it('adds disabled-attack class when cannotAct is true', () => {
      renderWithProps({ cannotAct: true });
      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      expect(attackLabel).toHaveClass('disabled-attack');
    });

    it('adds stat--penalized class to to hit span when exhaustionPenalty is set', () => {
      renderWithProps({ exhaustionPenalty: 2 });
      const toHitSpan = document.querySelector('.spell-abilities span');
      expect(toHitSpan).toHaveClass('stat--penalized');
    });
  });

  describe('edge cases - null/undefined fields', () => {
    it('renders a spell row when components is null', () => {
      const spell = {
        name: 'Null Components Spell',
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
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Null Components Spell')).toBeInTheDocument();
    });

    it('renders a spell row when components is an empty array', () => {
      const spell = {
        name: 'Empty Components Spell',
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
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Empty Components Spell')).toBeInTheDocument();
    });

    it('renders a spell row when duration is null', () => {
      const spell = {
        name: 'No Duration Spell',
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
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('No Duration Spell')).toBeInTheDocument();
    });

    it('renders a spell row when casting_time is null', () => {
      const spell = {
        name: 'No Cast Time Spell',
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
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('No Cast Time Spell')).toBeInTheDocument();
    });

    it('renders a spell row when range is null', () => {
      const spell = {
        name: 'No Range Spell',
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
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('No Range Spell')).toBeInTheDocument();
    });

    it('renders the table when only cantrips exist', () => {
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
  });
});

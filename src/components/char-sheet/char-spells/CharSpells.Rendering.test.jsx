// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';

import { mockPlayerStats, mockHandleTogglePreparedSpells } from './CharSpells.test.helpers.js';

import useActionPopup from '../../../hooks/combat/useActionPopup.js';
import useLoggedDiceRoll from '../../../hooks/combat/useLoggedDiceRoll.js';
import { useSpellMetamagicFlow } from '../../../hooks/combat/useSpellMetamagicFlow.js';
import { useSpellUpcastFlow } from '../../../hooks/combat/useSpellUpcastFlow.js';

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

vi.mock('../../../hooks/combat/useMetamagic.js', () => {
  const mockFn = () => ({
    currentSP: 10,
    maxSP: 10,
    spendSorceryPoints: vi.fn(),
    logMetamagic: vi.fn(),
  });
  mockFn.getCurrentSorceryPoints = vi.fn(() => 10);
  mockFn.getMaxSorceryPoints = vi.fn(() => 10);
  return {
    default: mockFn,
    getCurrentSorceryPoints: mockFn.getCurrentSorceryPoints,
    getMaxSorceryPoints: mockFn.getMaxSorceryPoints,
  };
});

vi.mock('../popups/MetamagicPopup.jsx', () => ({
  default: function MockMetamagicPopup({ onConfirm, onSkip }) {
    return (
      <div data-testid="metamagic-popup">
        <button data-testid="mock-confirm" onClick={() => onConfirm({ options: [], totalCost: 0, twinTarget: null })}>
          Mock Confirm
        </button>
        <button data-testid="mock-skip" onClick={onSkip}>
          Mock Skip
        </button>
      </div>
    );
  },
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('./CharSpellSlots.jsx', () => ({
  default: function MockCharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
  },
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingMultiTarget: null,
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

vi.mock('../../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({ players: [], placedItems: [] })),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('./SpellDetailPopup.jsx', () => ({
  default: function SpellDetailPopup({ spell }) {
    return <div data-testid="spell-detail-popup">{spell?.name}</div>;
  },
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: function DiceRollResult() {
    return <div data-testid="dice-roll-result">DiceRollResult</div>;
  },
}));

vi.mock('../common/Popup.jsx', () => ({
  default: function Popup({ children }) {
    return <div data-testid="popup-overlay">{children}</div>;
  },
}));

vi.mock('./UpcastPopup.jsx', () => ({
  default: function UpcastPopup() {
    return <div data-testid="upcast-popup">Upcast</div>;
  },
}));

vi.mock('../popups/MultiTargetPopup.jsx', () => ({
  default: function MultiTargetPopup() {
    return <div data-testid="multi-target-popup">MultiTarget</div>;
  },
}));

vi.mock('../popups/MultiTargetCountPopup.jsx', () => ({
  default: function MultiTargetCountPopup() {
    return <div data-testid="multi-target-count-popup">MultiTargetCount</div>;
  },
}));

vi.mock('../popups/TargetWithCheckboxesPopup.jsx', () => ({
  default: function TargetWithCheckboxesPopup() {
    return <div data-testid="target-with-checkboxes-popup">TargetWithCheckboxes</div>;
  },
}));

vi.mock('../popups/SingleTargetPopup.jsx', () => ({
  default: function SingleTargetPopup() {
    return <div data-testid="single-target-popup">SingleTarget</div>;
  },
}));

vi.mock('../popups/TargetWithTypePopup.jsx', () => ({
  default: function TargetWithTypePopup() {
    return <div data-testid="target-with-type-popup">TargetWithType</div>;
  },
}));

vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({
  default: function MagicMissileTargetPopup() {
    return <div data-testid="magic-missile-popup">MagicMissile</div>;
  },
}));

describe('CharSpells rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));
  });

  describe('empty spellAbilities scenarios', () => {
    it('renders no spell section when spellAbilities is undefined', () => {
      const stats = { name: 'Test Character' };

      const { container } = render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(container.querySelector('.spell-popup-parent')).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders no spell section when spellAbilities is null', () => {
      const stats = { name: 'Test Character', spellAbilities: null };

      const { container } = render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(container.querySelector('.spell-popup-parent')).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders no spell section when spells array is empty', () => {
      const stats = {
        name: 'Test Character',
        spellAbilities: {
          toHit: 5,
          modifier: 3,
          saveDc: 13,
          spells: [],
        },
      };

      const { container } = render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(container.querySelector('.spell-popup-parent')).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('spell abilities section rendering', () => {
    it('renders the Spells section header', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByText('Spells')).toBeInTheDocument();
    });

    it('renders the spell attack to-hit display', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByText(/Attack \(to hit\):/)).toBeInTheDocument();
    });

    it('renders the spell modifier display', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByText(/Modifier:/)).toBeInTheDocument();
    });

    it('renders the save DC display', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByText(/Save DC:/)).toBeInTheDocument();
    });

    it('renders cantrips known count', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByText(/Cantrips Known:/)).toBeInTheDocument();
    });

    it('renders prepared spells count for 5e rules', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByText(/Prepared Spells:/)).toBeInTheDocument();
      expect(screen.getByText(/Max Prepared:/)).toBeInTheDocument();
    });

    it('renders CharSpellSlots component', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByTestId('char-spell-slots')).toBeInTheDocument();
    });
  });

  describe('spell table rendering', () => {
    it('renders all spell names from the player stats', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Detect Magic')).toBeInTheDocument();
    });

    it('renders the spell table with correct column headers', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByText('Spell')).toBeInTheDocument();
      expect(screen.getByText('Level')).toBeInTheDocument();
      expect(screen.getByText('Prepared')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('Range')).toBeInTheDocument();
      expect(screen.getByText('Effect')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
    });

    it('renders a spell row with clickable spell name', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const spellName = screen.getByText('Light');
      expect(spellName).toHaveClass('clickable');
    });

    it('renders a spell row with the correct level display', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const rows = table.querySelectorAll('tbody tr');
      const levelCells = Array.from(rows).map(row => row.querySelectorAll('td')[1].textContent);
      expect(levelCells).toContain('1');
      expect(levelCells).toContain('Cantrip');
    });

    it('renders a cantrip row with "Cantrip" level text', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const rows = table.querySelectorAll('tbody tr');
      const lightRow = Array.from(rows).find(row => row.querySelectorAll('td')[0].textContent === 'Light');
      const levelCell = lightRow.querySelectorAll('td')[1];
      expect(levelCell.textContent).toBe('Cantrip');
    });

    it('renders damage display for a spell with damage', () => {
      const spellWithDamage = {
        name: 'Custom Spell',
        level: 1,
        casting_time: '1 turn',
        range: '60 feet',
        duration: 'Instantaneous',
        components: ['V', 'S'],
        damage: {
          damage_at_slot_level: { '1': '2d6' },
          damage_type: 'Acid',
        },
        prepared: 'Always',
      };
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [spellWithDamage],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const effectCell = row.querySelectorAll('td')[5];
      expect(effectCell.textContent).toContain('2d6');
      expect(effectCell.textContent).toContain('Acid');
    });

    it('renders "Utility" for a spell without damage', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Light',
              level: 0,
              casting_time: '1 action',
              range: 'Touch',
              duration: '10 minutes',
              components: ['V', 'M'],
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const effectCell = row.querySelectorAll('td')[5];
      expect(effectCell.textContent).toBe('Utility');
    });

    it('renders notes column with only components (concentration is in Duration column)', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Concentration Spell',
              level: 1,
              casting_time: '1 action',
              range: '60 feet',
              duration: 'Concentration',
              components: ['V'],
              concentration: true,
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const notesCell = row.querySelectorAll('td')[7];
      expect(notesCell.textContent).toBe('V');
    });

    it('renders notes column with components joined by slashes', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Multi Component Spell',
              level: 3,
              casting_time: '1 action',
              range: '300 feet',
              duration: '1 round',
              components: ['V', 'S', 'M'],
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const notesCell = row.querySelectorAll('td')[7];
      expect(notesCell.textContent).toBe('V/S/M');
    });

    it('renders notes column as empty when components is undefined', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'No Components Spell',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const notesCell = row.querySelectorAll('td')[7];
      expect(notesCell.textContent).toBe('');
    });

    it('renders duration with abbreviated values', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Duration Spell',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              duration: '10 minutes',
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const durationCell = row.querySelectorAll('td')[6];
      expect(durationCell.textContent).toContain('min');
    });

    it('renders casting time with abbreviated values', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Casting Time Spell',
              level: 1,
              casting_time: '1 bonus action',
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const timeCell = row.querySelectorAll('td')[3];
      expect(timeCell.textContent).toContain('BA');
    });

    it('renders casting time as empty when undefined', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'No Casting Time Spell',
              level: 1,
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const timeCell = row.querySelectorAll('td')[3];
      expect(timeCell.textContent).toBe('');
    });

    it('renders duration as empty when undefined', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'No Duration Spell',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const durationCell = row.querySelectorAll('td')[6];
      expect(durationCell.textContent).toBe('');
    });

    it('renders range as empty when undefined', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'No Range Spell',
              level: 1,
              casting_time: '1 action',
              duration: 'Instantaneous',
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const rangeCell = row.querySelectorAll('td')[4];
      expect(rangeCell.textContent).toBe('');
    });

    it('renders damage cell as clickable when spell has damage', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Damage Spell',
              level: 1,
              casting_time: '1 action',
              range: '60 feet',
              duration: 'Instantaneous',
              damage: {
                damage_at_slot_level: { '1': '2d6' },
                damage_type: 'Acid',
              },
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const effectCell = row.querySelectorAll('td')[5];
      expect(effectCell.classList.contains('clickable')).toBe(true);
    });

    it('renders damage cell as non-clickable when spell has no damage', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'No Damage Spell',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const effectCell = row.querySelectorAll('td')[5];
      expect(effectCell.classList.contains('clickable')).toBe(false);
    });

    it('renders effect with save DC info when spell has a DC', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'DC Spell',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Instantaneous',
              components: ['V', 'S'],
              damage: {
                damage_at_slot_level: { '1': '3d6' },
                damage_type: 'Fire',
              },
              dc: {
                dc_type: 'Dex',
                dc_success: 'half',
              },
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const effectCell = row.querySelectorAll('td')[5];
      expect(effectCell.textContent).toContain('3d6');
      expect(effectCell.textContent).toContain('Fire');
      expect(effectCell.textContent).toContain('Dex');
      expect(effectCell.textContent).toContain('half');
    });

    it('renders effect with empty damage objects as containing undefined', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Empty Damage Spell',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              components: ['V'],
              damage: {
                damage_at_slot_level: {},
                damage_at_character_level: {},
              },
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const effectCell = row.querySelectorAll('td')[5];
      expect(effectCell.textContent).toContain('undefined');
    });

    it('renders effect with null damage as Utility', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Null Damage Spell',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Instantaneous',
              components: ['V'],
              damage: null,
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={stats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const effectCell = row.querySelectorAll('td')[5];
      expect(effectCell.textContent).toBe('Utility');
    });
  });

  describe('popup rendering', () => {



    it('does not render any popup when both popups are null', () => {
      useActionPopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: vi.fn(),
      }));
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
    });

    it('renders the spell detail popup when a spell is selected', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const spellName = screen.getByText('Fireball');
      fireEvent.click(spellName);

      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(screen.getByTestId('spell-detail-popup').textContent).toContain('Fireball');
    });

    it('renders the upcast popup when upcast is pending', () => {
      useSpellUpcastFlow.mockImplementation(() => ({
        pendingUpcast: { spell: { name: 'Fireball', level: 3 } },
        buildUpcastLevels: vi.fn(() => [4, 5, 6]),
        gateUpcast: vi.fn(() => true),
        handleUpcastConfirm: vi.fn(),
        handleUpcastCancel: vi.fn(),
        getCantripAutoLevel: vi.fn(() => null),
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByTestId('upcast-popup')).toBeInTheDocument();
    });

    it('renders the metamagic popup when metamagic is pending', () => {
      useSpellMetamagicFlow.mockImplementation(() => ({
        pendingMetamagic: { spellName: 'Fireball', spellLevel: 3, _currentSP: 10, isPsionic: false, psionicCost: 0 },
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingMultiTarget: null,
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
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });

    it('renders the multi-target popup when multi-target is pending', () => {
      useSpellMetamagicFlow.mockImplementation(() => ({
        pendingMetamagic: null,
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingMultiTarget: {
          spellName: 'Burning Hands',
          spellLevel: 1,
          range: 'Self',
          creatureTargets: ['Goblin', 'Skeleton'],
        },
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
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByTestId('multi-target-popup')).toBeInTheDocument();
    });

    it('renders the aid target popup when aid is pending', () => {
      useSpellMetamagicFlow.mockImplementation(() => ({
        pendingMetamagic: null,
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingMultiTarget: null,
        handleMultiTargetConfirm: vi.fn(),
        handleMultiTargetSkip: vi.fn(),
        pendingAid: {
          spellName: 'Healing Word',
          spellLevel: 1,
          range: '60 feet',
          rangeFt: '60',
          creatureTargets: ['Ally1', 'Ally2'],
          maxTargets: 2,
          attackerPos: { gridX: 5, gridY: 5 },
        },
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
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByTestId('multi-target-count-popup')).toBeInTheDocument();
    });

    it('renders the heroes feast popup when heroes feast is pending', () => {
      useSpellMetamagicFlow.mockImplementation(() => ({
        pendingMetamagic: null,
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingMultiTarget: null,
        handleMultiTargetConfirm: vi.fn(),
        handleMultiTargetSkip: vi.fn(),
        pendingAid: null,
        handleAidConfirm: vi.fn(),
        handleAidSkip: vi.fn(),
        pendingHeroesFeast: {
          spellName: "Hero's Feast",
          spellLevel: 6,
          range: '30 feet',
          rangeFt: '30',
          creatureTargets: ['Ally'],
          maxTargets: 1,
          attackerPos: { gridX: 5, gridY: 5 },
        },
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
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByTestId('multi-target-count-popup')).toBeInTheDocument();
    });

    it('renders the greater restoration popup when pending', () => {
      useSpellMetamagicFlow.mockImplementation(() => ({
        pendingMetamagic: null,
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingMultiTarget: null,
        handleMultiTargetConfirm: vi.fn(),
        handleMultiTargetSkip: vi.fn(),
        pendingAid: null,
        handleAidConfirm: vi.fn(),
        handleAidSkip: vi.fn(),
        pendingHeroesFeast: null,
        handleHeroesFeastConfirm: vi.fn(),
        handleHeroesFeastSkip: vi.fn(),
        pendingGreaterRestoration: {
          spellName: 'Greater Restoration',
          spellLevel: 5,
          creatureTargets: ['Ally'],
          range: 'Touch',
        },
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
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByTestId('target-with-checkboxes-popup')).toBeInTheDocument();
    });

    it('renders the lesser restoration popup when pending', () => {
      useSpellMetamagicFlow.mockImplementation(() => ({
        pendingMetamagic: null,
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingMultiTarget: null,
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
        pendingLesserRestoration: {
          spellName: 'Lesser Restoration',
          spellLevel: 2,
          creatureTargets: ['Ally'],
          range: 'Touch',
        },
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
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByTestId('target-with-checkboxes-popup')).toBeInTheDocument();
    });

    it('renders the remove curse popup when pending', () => {
      useSpellMetamagicFlow.mockImplementation(() => ({
        pendingMetamagic: null,
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingMultiTarget: null,
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
        pendingRemoveCurse: {
          spellName: 'Remove Curse',
          spellLevel: 3,
          creatureTargets: ['Ally'],
          range: 'Touch',
        },
        handleRemoveCurseConfirm: vi.fn(),
        handleRemoveCurseSkip: vi.fn(),
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByTestId('target-with-checkboxes-popup')).toBeInTheDocument();
    });

    it('renders the mage armor popup when pending', () => {
      useSpellMetamagicFlow.mockImplementation(() => ({
        pendingMetamagic: null,
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingMultiTarget: null,
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
        pendingMageArmor: {
          spellName: 'Mage Armor',
          spellLevel: 1,
          creatureTargets: ['Ally'],
          range: 'Touch',
        },
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
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByTestId('single-target-popup')).toBeInTheDocument();
    });

    it('renders the shield of faith popup when pending', () => {
      useSpellMetamagicFlow.mockImplementation(() => ({
        pendingMetamagic: null,
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingMultiTarget: null,
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
        pendingShieldOfFaith: {
          spellName: 'Shield of Faith',
          spellLevel: 2,
          creatureTargets: ['Ally'],
          range: '60 feet',
        },
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
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByTestId('single-target-popup')).toBeInTheDocument();
    });

    it('renders the protection from energy popup when pending', () => {
      useSpellMetamagicFlow.mockImplementation(() => ({
        pendingMetamagic: null,
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingMultiTarget: null,
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
        pendingProtectionFromEnergy: {
          spellName: 'Protection from Energy',
          spellLevel: 3,
          creatureTargets: ['Ally'],
          range: 'Touch',
          damageTypes: ['Fire', 'Cold'],
        },
        handleProtectionFromEnergyConfirm: vi.fn(),
        handleProtectionFromEnergySkip: vi.fn(),
        pendingResistance: null,
        handleResistanceConfirm: vi.fn(),
        handleResistanceSkip: vi.fn(),
        pendingRemoveCurse: null,
        handleRemoveCurseConfirm: vi.fn(),
        handleRemoveCurseSkip: vi.fn(),
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByTestId('target-with-type-popup')).toBeInTheDocument();
    });

    it('renders the resistance popup when pending', () => {
      useSpellMetamagicFlow.mockImplementation(() => ({
        pendingMetamagic: null,
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingMultiTarget: null,
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
        pendingResistance: {
          spellName: 'Resistance',
          spellLevel: 0,
          creatureTargets: ['Ally'],
          range: 'Touch',
          damageTypes: ['Fire'],
        },
        handleResistanceConfirm: vi.fn(),
        handleResistanceSkip: vi.fn(),
        pendingRemoveCurse: null,
        handleRemoveCurseConfirm: vi.fn(),
        handleRemoveCurseSkip: vi.fn(),
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.getByTestId('target-with-type-popup')).toBeInTheDocument();
    });

    it('does not render any target popup when all pending values are null', () => {
      useSpellMetamagicFlow.mockImplementation(() => ({
        pendingMetamagic: null,
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingMultiTarget: null,
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
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.queryByTestId('metamagic-popup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('multi-target-popup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('multi-target-count-popup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('multi-target-count-popup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('target-with-checkboxes-popup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('target-with-checkboxes-popup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('target-with-checkboxes-popup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('single-target-popup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('single-target-popup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('target-with-type-popup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('target-with-type-popup')).not.toBeInTheDocument();
    });

    it('does not render spell detail popup when no spell is selected', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });
  });
});

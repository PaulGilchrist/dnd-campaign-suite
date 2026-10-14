// @maintained-by-ai
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: (html) => html,
}));

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/class-wizard/overchannelHandler.js', () => ({
  getOverchannelNecroticDamage: vi.fn(() => null),
}));

vi.mock('../../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
}));

const basePlayerStats = {
  name: 'Elara',
  level: 5,
  class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
  abilities: [{ name: 'Charisma', bonus: 3 }],
  proficiency: 3,
  spellAbilities: {
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spell_slots_level_3: 2,
    spells: [],
    modifier: 3,
  },
  automation: { passives: [], actions: [] },
};

const baseSpell = {
  name: 'Magic Missile',
  level: 1,
  description: 'Three darts of force strike a creature.',
  casting_time: '1 action',
  range: '120 feet',
  duration: 'Instantaneous',
  damage: {
    damage_at_slot_level: {
      '1': '3d4+1',
      '2': '4d4+1',
    },
  },
  school: 'Evocation',
};

const mockCampaignName = 'test-campaign';

const renderPopup = (spell = baseSpell, playerStats = basePlayerStats, extraProps = {}) => {
  const onClose = vi.fn();
  const result = render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={mockCampaignName}
      onClose={onClose}
      {...extraProps}
    />,
  );
  return { ...result, onClose };
};

// Meta rows render as <span><b>Label:</b> value</span> — locate the <b> label
// and assert the row it belongs to carries the expected value.
const expectMetaRow = (label, value) => {
  expect(screen.getByText(`${label}:`).closest('span')).toHaveTextContent(`${label}: ${value}`);
};

const upcastRadio = (level) =>
  screen.getAllByRole('radio').find((radio) => radio.value === String(level));

describe('SpellDetailPopup - rendering', () => {
  describe('spell detail content', () => {
    it.each([
      { description: 'Three darts of force strike a creature.', body: 'Three darts of force strike a creature.' },
      { description: ['First paragraph.', 'Second paragraph.'], body: 'First paragraph.Second paragraph.' },
    ])('renders the spell name as a heading with the description body — $body', ({ description, body }) => {
      renderPopup({ ...baseSpell, description });
      expect(screen.getByRole('heading', { name: 'Magic Missile' })).toBeInTheDocument();
      expect(screen.getByText(body)).toBeInTheDocument();
    });

    it('shows level, casting time, range, duration, and school from the spell data', () => {
      renderPopup();
      expectMetaRow('Level', '1');
      expectMetaRow('Casting Time', '1 action');
      expectMetaRow('Range', '120 feet');
      expectMetaRow('Duration', 'Instantaneous');
      expectMetaRow('School', 'Evocation');
    });

    it('shows an em dash for omitted casting time, range, and duration, and hides the school row', () => {
      renderPopup({
        ...baseSpell,
        casting_time: undefined,
        range: undefined,
        duration: undefined,
        school: undefined,
      });
      expectMetaRow('Casting Time', '—');
      expectMetaRow('Range', '—');
      expectMetaRow('Duration', '—');
      expect(screen.queryByText('School:')).not.toBeInTheDocument();
    });

    it.each([
      { area: { type: 'Cone', size: '60-foot' }, expected: 'Cone - 60-foot', label: 'a sized area' },
      { area: { type: 'Self' }, expected: 'Self', label: 'a sizeless area' },
    ])('shows the area of effect for $label', ({ area, expected }) => {
      renderPopup({ ...baseSpell, area_of_effect: area });
      expectMetaRow('Area', expected);
    });

    it('shows "Level: Cantrip" with no slots row and no upcast selector for a cantrip', () => {
      const cantrip = {
        ...baseSpell,
        name: 'Fire Bolt',
        level: 0,
        casting_time: '1 action',
        damage: { damage_at_slot_level: { '0': '1d10', '1': '2d10' } },
      };
      renderPopup(cantrip);
      expectMetaRow('Level', 'Cantrip');
      expect(screen.queryByText(/Cast at Level:/)).not.toBeInTheDocument();
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      expect(screen.queryByText(/Slots Remaining:/)).not.toBeInTheDocument();
    });
  });

  describe('upcast selector', () => {
    it('shows one radio per upcast level, pre-selects the first level, and hides the slots row', () => {
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 4 },
        { level: 2, formula: '4d4+1', availableSlots: 3 },
      ];
      renderPopup(baseSpell, basePlayerStats, { upcastLevels });

      expect(screen.getByText(/Cast at Level:/)).toBeInTheDocument();
      const radios = screen.getAllByRole('radio');
      expect(radios.map((radio) => radio.value)).toEqual(['1', '2']);
      expect(upcastRadio(1)).toBeChecked();
      expect(upcastRadio(2)).not.toBeChecked();
      expect(screen.getByText('3d4+1')).toBeInTheDocument();
      expect(screen.getByText('4d4+1')).toBeInTheDocument();
      expect(screen.getByText('4 slots')).toBeInTheDocument();
      expect(screen.getByText('3 slots')).toBeInTheDocument();
      // The per-level radios replace the single slots row — both together is a bug.
      expect(screen.queryByText(/Slots Remaining:/)).not.toBeInTheDocument();
    });

    it('pre-selects the first level with available slots when the base level is exhausted', () => {
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 0 },
        { level: 2, formula: '4d4+1', availableSlots: 1 },
      ];
      renderPopup(baseSpell, basePlayerStats, { upcastLevels });

      expect(upcastRadio(1)).toBeDisabled();
      expect(upcastRadio(1)).not.toBeChecked();
      expect(upcastRadio(2)).toBeEnabled();
      expect(upcastRadio(2)).toBeChecked();
      expect(screen.getByText('1 slot')).toBeInTheDocument();
    });

    it('hides the selector but keeps the slots row when only one upcast level exists', () => {
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 4 },
      ];
      renderPopup(baseSpell, basePlayerStats, { upcastLevels });

      expect(screen.queryByText(/Cast at Level:/)).not.toBeInTheDocument();
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      expect(screen.getByText(/Slots Remaining:/)).toBeInTheDocument();
      expect(screen.getByText('4 slots')).toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('the Close button notifies the parent', () => {
      const { onClose } = renderPopup();
      fireEvent.click(screen.getByRole('button', { name: /Close/ }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

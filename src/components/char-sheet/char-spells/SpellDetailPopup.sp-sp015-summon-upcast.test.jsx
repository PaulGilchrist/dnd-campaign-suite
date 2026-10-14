// @maintained-by-ai
// SP-015: summon spells scale the creature's HP via automation.hpPerLevelAbove
// ("+5 HP per slot level above 2") and carry NO damage/heal ladder. That automation
// ladder alone must arm the Cast-at-Level selector for summon_spirit spells, and the
// cast payload must carry the chosen slot level plus the automation metadata the
// summon resolver scales HP from.
//
// Generic selector mechanics (radio rendering, first-available pre-select, single-level
// hiding, slots-row swap) live in SpellDetailPopup.rendering.test.jsx — not duplicated.
import { render, screen, fireEvent } from '@testing-library/react';
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

const playerStats = {
  name: 'Wild_Sage_Druid',
  level: 20,
  class: { name: 'Druid' },
  abilities: [{ name: 'Wisdom', bonus: 5 }],
  proficiency: 6,
  spellAbilities: {
    spell_slots_level_2: 3,
    spell_slots_level_3: 3,
    saveDc: 17,
    toHit: 11,
    modifier: 5,
    spells: [],
  },
  automation: { passives: [], actions: [] },
};

// Deliberately carries no `damage` / `heal_at_slot_level` ladder — only the
// automation HP ladder can arm the selector. That is the SP-015 regression.
const bestialSpirit = {
  name: 'Bestial Spirit',
  level: 2,
  description: ["<p>A small, neutral beast appears. The beast's AC equals 11 + the spell's level.</p>"],
  casting_time: 'Action',
  range: '60 feet',
  duration: 'Concentration, up to 1 hour',
  school: 'Conjuration',
  concentration: true,
  automation: {
    type: 'summon_spirit',
    typeLabel: 'Bestial Spirit',
    baseLevel: 2,
    hpPerLevelAbove: 5,
    variants: [],
  },
};

const ladder = [
  { level: 2, formula: '+5 HP per slot level above 2', availableSlots: 3 },
  { level: 3, formula: '+5 HP per slot level above 2', availableSlots: 3 },
];

const renderPopup = (spell = bestialSpirit) => {
  const onCast = vi.fn();
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName="test-campaign"
      playerLevel={20}
      upcastLevels={ladder}
      onClose={vi.fn()}
      onCast={onCast}
    />,
  );
  return { onCast };
};

const upcastRadio = (level) =>
  screen.getAllByRole('radio').find((radio) => radio.value === String(level));

const castButton = () => screen.getByRole('button', { name: /Cast Spell/i });

describe('SpellDetailPopup SP-015 summon HP-ladder upcast', () => {
  it('arms the Cast-at-Level selector from automation.hpPerLevelAbove alone', () => {
    // Fixture guard: if a damage/heal ladder ever lands on this fixture, the test
    // no longer proves the automation ladder is what armed the selector.
    expect(bestialSpirit.damage).toBeUndefined();
    expect(bestialSpirit.heal_at_slot_level).toBeUndefined();

    renderPopup();

    expect(screen.getByText(/Cast at Level:/)).toBeInTheDocument();
    expect(screen.queryByText(/Slots Remaining:/)).not.toBeInTheDocument();
    expect(castButton()).toBeEnabled();
  });

  it.each([
    { selected: 2, isUpcast: false, upcastLevel: undefined, label: 'the pre-selected base level' },
    { selected: 3, isUpcast: true, upcastLevel: 3, label: 'a higher slot level' },
  ])('casts at $label and preserves the automation metadata the summon resolver scales HP from', ({ selected, isUpcast, upcastLevel }) => {
    const { onCast } = renderPopup();

    fireEvent.click(upcastRadio(selected));
    fireEvent.click(castButton());

    expect(onCast).toHaveBeenCalledTimes(1);
    const [spellArg] = onCast.mock.calls[0];
    expect(spellArg.isUpcast).toBe(isUpcast);
    expect(spellArg.upcastLevel).toBe(upcastLevel);
    // The resolver computes final HP from baseLevel + hpPerLevelAbove — the
    // spread in handleCast must not drop it.
    expect(spellArg.automation.baseLevel).toBe(2);
    expect(spellArg.automation.hpPerLevelAbove).toBe(5);
  });

  it.each([
    { label: 'hpPerLevelAbove missing', automation: { type: 'summon_spirit', baseLevel: 2, variants: [] } },
    { label: 'hpPerLevelAbove is 0', automation: { type: 'summon_spirit', baseLevel: 2, hpPerLevelAbove: 0, variants: [] } },
    { label: 'automation is not summon_spirit', automation: { type: 'conjure_beast', baseLevel: 2, hpPerLevelAbove: 5, variants: [] } },
  ])('leaves the selector disarmed for a summon-shaped spell with $label', ({ automation }) => {
    renderPopup({ ...bestialSpirit, automation });

    expect(screen.queryByText(/Cast at Level:/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    // Falls back to the plain slots row for the base level.
    expect(screen.getByText('Slots Remaining:').closest('span')).toHaveTextContent('Slots Remaining: 3 slots');
  });
});

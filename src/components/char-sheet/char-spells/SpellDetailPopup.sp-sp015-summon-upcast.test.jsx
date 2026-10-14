// @improved-by-ai
// SP-015: A summon_spirit spell with automation.hpPerLevelAbove but NO damage/heal
// ladder (Bestial Spirit: "+5 HP per slot level above 2") must arm the Cast-at-Level
// selector via its automation ladder alone, and the chosen slot level plus automation
// metadata must reach the summon resolver in the onCast payload.
//
// Generic selector mechanics (disabled radios, pre-select-first-available, single-level
// hiding) live in SpellDetailPopup.rendering.test.jsx — not duplicated here.
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

const renderPopup = (spell = bestialSpirit, extraProps = {}) => {
  const onCast = extraProps.onCast ?? vi.fn();
  const onClose = vi.fn();
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName="test-campaign"
      playerLevel={20}
      upcastLevels={ladder}
      onClose={onClose}
      {...extraProps}
      onCast={onCast}
    />,
  );
  return { onCast, onClose };
};

const upcastRadio = (level) =>
  screen.getAllByRole('radio').find((radio) => radio.value === String(level));

const castButton = () => screen.getByRole('button', { name: /Cast Spell/i });

describe('SpellDetailPopup SP-015 summon HP-ladder upcast', () => {
  it('arms the Cast-at-Level selector from automation.hpPerLevelAbove alone — the spell has no damage or heal ladder', () => {
    expect(bestialSpirit.damage).toBeUndefined();
    expect(bestialSpirit.heal_at_slot_level).toBeUndefined();

    renderPopup();

    expect(screen.getByText(/Cast at Level:/)).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((radio) => radio.value)).toEqual(['2', '3']);
    expect(upcastRadio(2)).toBeChecked();
    // The per-level radios replace the single slots row.
    expect(screen.queryByText(/Slots Remaining:/)).not.toBeInTheDocument();
    expect(castButton()).toBeEnabled();
  });

  it('casts at the chosen slot level and preserves the automation metadata the summon resolver scales HP from', () => {
    const { onCast } = renderPopup();

    fireEvent.click(upcastRadio(3));
    fireEvent.click(castButton());

    expect(onCast).toHaveBeenCalledTimes(1);
    const [spellArg, metaArg] = onCast.mock.calls[0];
    expect(spellArg.upcastLevel).toBe(3);
    expect(spellArg.isUpcast).toBe(true);
    // The resolver computes final HP from baseLevel + hpPerLevelAbove — the
    // spread in handleCast must not drop it.
    expect(spellArg.automation.baseLevel).toBe(2);
    expect(spellArg.automation.hpPerLevelAbove).toBe(5);
    expect(metaArg.overchannel).toBe(false);
  });

  it('reports a base-level cast (not an upcast) when the pre-selected base radio is left untouched', () => {
    const { onCast } = renderPopup();

    fireEvent.click(castButton());

    const [spellArg] = onCast.mock.calls[0];
    expect(spellArg.isUpcast).toBe(false);
    expect(spellArg.upcastLevel).toBeUndefined();
    expect(spellArg.automation.hpPerLevelAbove).toBe(5);
  });

  it.each([
    { label: 'hpPerLevelAbove missing', automation: { type: 'summon_spirit', baseLevel: 2, variants: [] } },
    { label: 'hpPerLevelAbove is 0', automation: { type: 'summon_spirit', baseLevel: 2, hpPerLevelAbove: 0, variants: [] } },
    { label: 'hpPerLevelAbove is non-numeric', automation: { type: 'summon_spirit', baseLevel: 2, hpPerLevelAbove: 'five', variants: [] } },
    { label: 'automation is not summon_spirit', automation: { type: 'conjure_beast', baseLevel: 2, hpPerLevelAbove: 5, variants: [] } },
  ])('leaves the selector disarmed for a summon-shaped spell with $label', ({ automation }) => {
    renderPopup({ ...bestialSpirit, automation });

    expect(screen.queryByText(/Cast at Level:/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    // Falls back to the plain slots row for the base level.
    expect(screen.getByText('Slots Remaining:').closest('span')).toHaveTextContent('Slots Remaining: 3 slots');
  });
});

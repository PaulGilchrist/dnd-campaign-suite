// SP-015: Bestial Spirit (summon_spirit) HP ladder arms the Cast-at-Level selector.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';

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

const bestialSpirit = {
  name: 'Bestial Spirit',
  level: 2,
  description: ['<p>A small, neutral beast appears. The beast\u0027s AC equals 11 + the spell\u0027s level.</p>'],
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

describe('SpellDetailPopup SP-015 summon HP-ladder upcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
  });

  it('arms the Cast-at-Level radio selector when automation.hpPerLevelAbove is present', () => {
    render(
      <SpellDetailPopup
        spell={bestialSpirit}
        playerStats={playerStats}
        campaignName="test-campaign"
        playerLevel={20}
        upcastLevels={ladder}
        onClose={vi.fn()}
        onCast={vi.fn()}
      />
    );
    expect(screen.getByText(/Cast at Level/i)).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.map(r => r.value)).toEqual(['2', '3']);
  });

  it('casts at the chosen upcast level so the slot level reaches the summon resolver', () => {
    const onCast = vi.fn();
    render(
      <SpellDetailPopup
        spell={bestialSpirit}
        playerStats={playerStats}
        campaignName="test-campaign"
        playerLevel={20}
        upcastLevels={ladder}
        onClose={vi.fn()}
        onCast={onCast}
      />
    );
    const lv3 = screen.getAllByRole('radio').find(r => r.value === '3');
    fireEvent.click(lv3);
    fireEvent.click(screen.getByRole('button', { name: /Cast Spell/i }));
    expect(onCast).toHaveBeenCalledTimes(1);
    const [spellArg, metaArg] = onCast.mock.calls[0];
    expect(spellArg.upcastLevel).toBe(3);
    expect(spellArg.isUpcast).toBe(true);
    expect(metaArg).toBeDefined();
  });

  it('summon without hpPerLevelAbove (scale:false) shows no upcast selector', () => {
    render(
      <SpellDetailPopup
        spell={{ ...bestialSpirit, automation: { type: 'summon_spirit', typeLabel: 'Animated Object', scale: false, variants: [] } }}
        playerStats={playerStats}
        campaignName="test-campaign"
        playerLevel={20}
        upcastLevels={ladder}
        onClose={vi.fn()}
        onCast={vi.fn()}
      />
    );
    expect(screen.queryByText(/Cast at Level/i)).not.toBeInTheDocument();
  });
});

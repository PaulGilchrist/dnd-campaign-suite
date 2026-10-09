// CLA-322: Spell Breaker — spell detail popup shows converted Bonus Action casting time.
import { render, screen } from '@testing-library/react';
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

const SPELL_BREAKER = {
  type: 'spell_breaker',
  name: 'Spell Breaker',
  bonusActionSpells: ['Dispel Magic'],
  slotRetentionSpells: ['Counterspell', 'Dispel Magic'],
};

const wizardStats = (passives = []) => ({
  name: 'DivinationWizard',
  level: 20,
  class: { name: 'Wizard', major: { name: 'Abjurer' } },
  abilities: [{ name: 'Intelligence', bonus: 3 }],
  proficiency: 6,
  spellAbilities: { spell_slots_level_3: 3, spells: [], modifier: 3 },
  automation: { passives },
});

const dispelMagic = {
  name: 'Dispel Magic',
  level: 3,
  description: 'Choose one creature, object, or magical effect.',
  casting_time: 'Action',
  range: '120 feet',
  duration: 'Instantaneous',
  school: 'Abjuration',
};

const renderPopup = (spell, playerStats) =>
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName="test-campaign"
      onClose={vi.fn()}
      onCast={vi.fn()}
      upcastLevels={[]}
      playerLevel={20}
    />
  );

describe('SpellDetailPopup — Spell Breaker casting time (CLA-322)', () => {
  it('shows "Bonus Action" for Dispel Magic when Spell Breaker is held', () => {
    renderPopup(dispelMagic, wizardStats([SPELL_BREAKER]));
    expect(screen.getByText('Bonus Action')).toBeInTheDocument();
  });

  it('shows base casting time without Spell Breaker', () => {
    renderPopup(dispelMagic, wizardStats([]));
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.queryByText('Bonus Action')).not.toBeInTheDocument();
  });

  it('shows base casting time for non-bonusActionSpells even with Spell Breaker', () => {
    renderPopup({ ...dispelMagic, name: 'Counterspell', casting_time: 'Reaction' }, wizardStats([SPELL_BREAKER]));
    expect(screen.getByText('Reaction')).toBeInTheDocument();
  });
});

// @maintained-by-ai
// CLA-322: Spell Breaker — spell detail popup casting-time display.
// Scope: this file owns ONLY the popup's "Casting Time:" meta row.
// Related CLA-322 coverage lives elsewhere — do not duplicate it here:
//   - registry helper:  src/services/ui/spellSectionUtils.spellBreaker.test.js
//   - cast payload:   SpellDetailPopup.specialFeatures.test.jsx (dispelAbilityCheckBonus)
//   - table display:  CharSpells.Rendering.test.jsx
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

// The component calls these synchronously — return plain booleans.
// (A Promise is truthy, which would silently make every cast possible.)
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

// NOTE: spellSectionUtils is deliberately NOT mocked — the popup's display must
// be exercised through the real registry helper so the full CLA-322 path is tested.

const CAMPAIGN = 'test-campaign';

const spellBreaker = (overrides = {}) => ({
  type: 'spell_breaker',
  name: 'Spell Breaker',
  bonusActionSpells: ['Dispel Magic'],
  slotRetentionSpells: ['Counterspell', 'Dispel Magic'],
  ...overrides,
});

const wizardStats = (passives = []) => ({
  name: 'DivinationWizard',
  level: 20,
  class: { name: 'Wizard', major: { name: 'Abjurer' } },
  abilities: [{ name: 'Intelligence', bonus: 3 }],
  proficiency: 6,
  spellAbilities: { spell_slots_level_3: 3, spells: [], modifier: 3 },
  automation: { passives, actions: [] },
});

const dispelMagic = (overrides = {}) => ({
  name: 'Dispel Magic',
  level: 3,
  description: 'Choose one creature, object, or magical effect.',
  casting_time: 'Action',
  range: '120 feet',
  duration: 'Instantaneous',
  school: 'Abjuration',
  ...overrides,
});

const counterspell = (overrides = {}) => ({
  name: 'Counterspell',
  level: 3,
  description: 'You attempt to interrupt a creature in the middle of casting a spell.',
  casting_time: 'Reaction',
  range: '60 feet',
  duration: 'Instantaneous',
  school: 'Abjuration',
  ...overrides,
});

const renderPopup = (spell, playerStats) =>
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={CAMPAIGN}
      onClose={vi.fn()}
      onCast={vi.fn()}
    />
  );

// Meta rows render as <span><b>Label:</b> value</span>. Scope assertions to the
// Casting Time row and anchor the value so a stray "Bonus Action" elsewhere — or
// an appended annotation on the row itself — can never satisfy them.
const expectCastingTime = (value) => {
  const row = screen.getByText('Casting Time:').closest('span');
  expect(row).toHaveTextContent(new RegExp(`^Casting Time:\\s*${value}$`));
};

describe('SpellDetailPopup — Spell Breaker casting time display (CLA-322)', () => {
  it('shows "Bonus Action" in the Casting Time row for a listed spell', () => {
    renderPopup(dispelMagic(), wizardStats([spellBreaker()]));
    expectCastingTime('Bonus Action');
  });

  it('is registry-driven: any spell listed in bonusActionSpells converts, overriding its base casting_time', () => {
    // Counterspell's base casting_time is "Reaction" — a hard-coded
    // "Dispel Magic" check or a casting_time-first display would fail here.
    renderPopup(
      counterspell(),
      wizardStats([spellBreaker({ bonusActionSpells: ['Counterspell'] })]),
    );
    expectCastingTime('Bonus Action');
  });

  it('shows the base casting time without the Spell Breaker passive', () => {
    renderPopup(dispelMagic(), wizardStats([]));
    expectCastingTime('Action');
    expect(screen.queryByText('Bonus Action')).not.toBeInTheDocument();
  });

  it('leaves spells outside bonusActionSpells unchanged, even when listed in slotRetentionSpells', () => {
    // Counterspell sits in slotRetentionSpells but not bonusActionSpells —
    // slot retention must not leak into the casting-time display.
    renderPopup(counterspell(), wizardStats([spellBreaker()]));
    expectCastingTime('Reaction');
    expect(screen.queryByText('Bonus Action')).not.toBeInTheDocument();
  });
});

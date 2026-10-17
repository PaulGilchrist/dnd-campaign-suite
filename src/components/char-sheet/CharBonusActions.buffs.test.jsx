// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharBonusActions from './CharBonusActions.jsx';

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 10),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn((_playerName, _campaignName) => ({ saveDcBonus: 0 })),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) {
      return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
  }),
}));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="metamagic-popup">{_props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="spell-detail-popup">{props.spell?.name || 'SpellDetailPopup'}</div>),
}));

vi.mock('./HexAbilityModal.jsx', () => ({
  default: vi.fn((props) => <div data-testid="hex-ability-modal"><button onClick={props.onCancel}>Cancel</button></div>),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn((props) => <div data-testid="secondary-target-modal">{props.title}</div>),
}));

vi.mock('./ArcaneVigorModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="arcane-vigor-modal">Arcane Vigor</div>),
}));

import { getRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const WRATH_DESCRIPTION = 'Force a creature to make a CON save or take WIS modifier d6 Cold damage.';

const basePlayerStats = {
  name: 'TestCharacter',
  rules: '5e',
  level: 5,
  attacks: [],
  bonusActions: [],
  spellAbilities: { spells: [] },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

// Wisdom bonus + a spell attack bonus deliberately different from the Wis-mod
// so payloads pin which source each modifier was taken from.
function makeStatsWithWisdom(wisBonus, level = 5) {
  return createStats({
    level,
    abilities: [{ name: 'Wisdom', bonus: wisBonus }],
    spellAbilities: { toHit: wisBonus + 4 },
    bonusActions: [{ name: 'TestFeature', description: 'test' }],
  });
}

function mockWrathActive(active) {
  vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
    key === 'wrathOfTheSeaActive' && active ? true : null);
}

function mockActiveBuffs(buffs) {
  vi.mocked(useRuntimeValue).mockImplementation((_name, key) =>
    key === 'activeBuffs' ? buffs : null);
}

describe('CharBonusActions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Wrath of the Sea buff row', () => {
    it.each([
      {
        label: 'synthesizes the row when the buff is active',
        active: true,
        bonusActions: [{ name: 'TestFeature', description: 'test' }],
        expectName: true,
        expectSynthesizedDescription: true,
      },
      {
        label: 'does not duplicate the row when bonusActions already provide it',
        active: true,
        bonusActions: [{ name: 'Wrath of the Sea', description: 'character data' }, { name: 'TestFeature', description: 'test' }],
        expectName: true,
        expectSynthesizedDescription: false,
      },
      {
        label: 'renders nothing when the buff is inactive',
        active: false,
        bonusActions: [{ name: 'TestFeature', description: 'test' }],
        expectName: false,
        expectSynthesizedDescription: false,
      },
    ])('$label', ({ active, bonusActions, expectName, expectSynthesizedDescription }) => {
      mockWrathActive(active);
      render(<CharBonusActions playerStats={createStats({ bonusActions })} onAutomationAction={vi.fn()} />);
      // The hardcoded description only ever appears on the synthesized row,
      // so its absence proves the dedupe/inactive guard fired, not just a count.
      expect(screen.queryAllByText('Wrath of the Sea:')).toHaveLength(expectName ? 1 : 0);
      expect(screen.queryAllByText(WRATH_DESCRIPTION)).toHaveLength(expectSynthesizedDescription ? 1 : 0);
    });

    it('clicking the row dispatches the wrath_of_the_sea bonus action payload', () => {
      mockWrathActive(true);
      const onAutomationAction = vi.fn();
      render(<CharBonusActions playerStats={createStats({ bonusActions: [{ name: 'TestFeature', description: 'test' }] })} onAutomationAction={onAutomationAction} />);
      fireEvent.click(screen.getByText('Wrath of the Sea:'));
      expect(onAutomationAction).toHaveBeenCalledWith({
        name: 'Wrath of the Sea',
        description: WRATH_DESCRIPTION,
        automation: {
          type: 'wrath_of_the_sea',
          action: 'bonus_action',
          allyAttack: true,
        },
      });
    });
  });

  describe('Starry Form: Luminous Arrow row', () => {
    it.each([
      { label: 'fires 1d8 below level 10', buffs: [{ name: 'Starry Form', constellation: 'Archer' }], level: 5, expect: true, dice: '1d8' },
      { label: 'fires 2d8 from level 10', buffs: [{ name: 'Starry Form', constellation: 'Archer' }], level: 10, expect: true, dice: '2d8' },
      { label: 'absent when no buffs are active', buffs: null, level: 5, expect: false },
      { label: 'absent when the constellation is not Archer', buffs: [{ name: 'Starry Form', constellation: 'Chalice' }], level: 10, expect: false },
    ])('$label', ({ buffs, level, expect: shouldShow, dice }) => {
      mockActiveBuffs(buffs);
      render(<CharBonusActions playerStats={makeStatsWithWisdom(3, level)} onAutomationAction={vi.fn()} />);
      if (shouldShow) {
        expect(screen.getByText('Starry Form: Luminous Arrow:')).toBeInTheDocument();
        expect(screen.getByText(`Ranged spell attack, 60 ft. On a hit: ${dice} + 3 Radiant damage.`)).toBeInTheDocument();
      } else {
        expect(screen.queryAllByText(/Luminous Arrow/)).toHaveLength(0);
      }
    });

    it('clicking the row takes damageBonus from Wisdom and spellAttackMod from spellAbilities.toHit', () => {
      mockActiveBuffs([{ name: 'Starry Form', constellation: 'Archer' }]);
      const onAutomationAction = vi.fn();
      render(<CharBonusActions playerStats={makeStatsWithWisdom(3, 5)} onAutomationAction={onAutomationAction} />);
      fireEvent.click(screen.getByText('Starry Form: Luminous Arrow:'));
      expect(onAutomationAction).toHaveBeenCalledWith({
        name: 'Starry Form: Luminous Arrow',
        description: 'Ranged spell attack, 60 ft. On a hit: 1d8 + 3 Radiant damage.',
        automation: {
          type: 'starry_form_arrow',
          action: 'bonus_action',
          damageDice: '1d8',
          damageType: 'Radiant',
          damageBonus: 3,
          spellAttackMod: 7,
          range: '60_ft',
        },
      });
    });
  });

  it('renders both buff rows together, and cannotAct does not gate either row', () => {
    mockWrathActive(true);
    mockActiveBuffs([{ name: 'Starry Form', constellation: 'Archer' }]);
    render(<CharBonusActions playerStats={makeStatsWithWisdom(3, 5)} campaignName="test-campaign" cannotAct={true} onAutomationAction={vi.fn()} />);
    expect(screen.getByText('Wrath of the Sea:')).toBeInTheDocument();
    expect(screen.getByText('Starry Form: Luminous Arrow:')).toBeInTheDocument();
  });
});

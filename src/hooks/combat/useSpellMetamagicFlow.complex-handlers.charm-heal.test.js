// @maintained-by-ai: 2026-10-15
// Charm/heal confirm routing for useSpellMetamagicFlow (SIMPLE_SPELL_SPECS lane).
// Owns: Charm Person / Charm Monster trigger threading (charmPersonTargets /
// charmMonsterTargets + characters) and Healing Word / Heal object-target confirms
// incl. missing-target guards. Owned elsewhere: popup payloads → confirm-payloads,
// skip lanes → skip.test.js, upcast slot levels → cla086-upcast-slot.test.js,
// no-pending guards → handler-guards.test.js. Spell levels/casting times are
// disk-derived from public/data/spells.json (Charm Person lv1, Charm Monster lv4,
// Healing Word lv1 bonus, Heal lv6).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// useConfirmableFlow.fireConfirmLaneRider imports both riders on every confirm —
// stub them so the riders seam stays out of this routing lane's assertions.
vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      { name: 'Goblin C' },
    ],
  })),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

// Full factory mock: automation/index is statically imported by several handler
// modules. Runners reference members lazily (thunks), so only entries whose
// handlers execute here (none in this lane — all route through feature
// services) need meaningful return values.
vi.mock('../../services/automation/index.js', () => ({
  applyAidEffect: vi.fn(),
  applyHeroesFeastEffect: vi.fn(),
  applyLesserRestorationEffect: vi.fn(),
  applyMageArmorEffect: vi.fn(),
  applyProtectionFromEnergyHandler: vi.fn(),
  applyProtectionFromEvilAndGood: vi.fn(),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve(null)),
  applyResistanceEffect: vi.fn(),
  executeHandler: vi.fn(() => Promise.resolve(null)),
  confirmGreaterRestoration: vi.fn(),
  applyHolyAuraEffect: vi.fn(() => Promise.resolve(null)),
  applyBaneEffect: vi.fn(),
  applyBlessEffect: vi.fn(),
  applyFaerieFire: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(),
  applyEnhanceAbilityEffect: vi.fn(() => Promise.resolve(null)),
  applyBarkskinEffect: vi.fn(() => Promise.resolve(null)),
  applyInvisibility: vi.fn(),
  applyGreaterInvisibility: vi.fn(),
  applyFeignDeath: vi.fn(() => Promise.resolve(null)),
  applyLongstriderEffect: vi.fn(() => Promise.resolve(null)),
  applySpareTheDyingEffect: vi.fn(() => Promise.resolve(null)),
  applyBeaconOfHopeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfLifeEffect: vi.fn(),
  applyAuraOfPurityEffect: vi.fn(),
  applyCircleOfPowerEffect: vi.fn(() => Promise.resolve(null)),
  applyCompulsionEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfVitalityEffect: vi.fn(() => Promise.resolve(null)),
  applyDeathWardEffect: vi.fn(() => Promise.resolve(null)),
  applyHeroism: vi.fn(() => Promise.resolve(null)),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
  handleSanctuary: vi.fn(() => Promise.resolve(null)),
}));

// Feature-service mocks below mirror the static imports of useSimpleSpellHandlers
// / useComplexSpellHandlers — every statically-imported module must be covered by
// a factory even when only the charm/heal thunks run here.
vi.mock('../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn(),
}));

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/regenerateService.js', () => ({
  confirmRegenerate: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/holdMonsterService.js', () => ({
  triggerHoldMonster: vi.fn(),
}));

vi.mock('../../services/rules/features/charmPersonService.js', () => ({
  triggerCharmPerson: vi.fn(),
}));

vi.mock('../../services/rules/features/charmMonsterService.js', () => ({
  triggerCharmMonster: vi.fn(),
}));

vi.mock('../../services/rules/features/banishmentService.js', () => ({
  triggerBanishment: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/faerieFireService.js', () => ({
  triggerFaerieFire: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/healService.js', () => ({
  triggerHeal: vi.fn(),
}));

vi.mock('../../services/rules/features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
  applyPolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({
  applyAnimalShapes: vi.fn(() => Promise.resolve({ ok: false })),
}));

vi.mock('../../services/automation/handlers/spells/truePolymorphService.js', () => ({
  applyTruePolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ creatures: [] }),
  text: () => Promise.resolve(''),
}));

const CAMPAIGN = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
    ...overrides,
  };
}

// Render the flow and gate the spell so its sheet-confirm pending opens.
// Spell fields default to the Charm Person disk record; callers override
// per-spell values straight from public/data/spells.json.
async function renderGated(spellOverrides = {}, playerOverrides = {}) {
  const playerStats = makePlayerStats(playerOverrides);
  const onExecute = vi.fn();
  const setPopupHtml = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({ playerStats, campaignName: CAMPAIGN, onExecute, setPopupHtml })
  );
  const spell = {
    name: 'Charm Person',
    level: 1,
    casting_time: '1 action',
    range: '30 feet',
    ...spellOverrides,
  };
  await act(async () => {
    await result.current.gateMetamagic(spell);
  });
  return { result, onExecute, setPopupHtml, playerStats, spell };
}

describe('useSpellMetamagicFlow — Charm Person confirm lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gates humanoid targets, threads them to triggerCharmPerson, logs the cast, clears pending', async () => {
    const { result, spell } = await renderGated();

    // gateCharmPerson resolves humanoids (monsterUtils mock) into creatureTargets
    expect(result.current.pendingCharmPerson).not.toBeNull();
    expect(result.current.pendingCharmPerson.creatureTargets).toEqual(['Goblin A', 'Goblin B', 'Goblin C']);

    const { triggerCharmPerson } = await import('../../services/rules/features/charmPersonService.js');

    await act(async () => {
      await result.current.handleCharmPersonConfirm(['Goblin A']);
    });

    // CLA-219 shape: charm targets + characters ride the trigger metaCtx
    expect(triggerCharmPerson).toHaveBeenCalledWith(
      spell,
      expect.objectContaining({ charmPersonTargets: ['Goblin A'], characters: [] }),
      expect.objectContaining({ name: 'TestSorcerer' }),
      CAMPAIGN,
      null,
    );
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'spell',
      characterName: 'TestSorcerer',
      targetName: 'Goblin A',
      targets: ['Goblin A', 'Goblin B', 'Goblin C'],
      spellName: 'Charm Person',
      spellLevel: 1,
      castingTime: '1 action',
      timestamp: expect.any(Number),
    });
    expect(result.current.pendingCharmPerson).toBeNull();
  });
});

describe('useSpellMetamagicFlow — Charm Monster confirm lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes confirm targets to triggerCharmMonster and clears pending', async () => {
    const { result, spell } = await renderGated({ name: 'Charm Monster', level: 4 });

    expect(result.current.pendingCharmMonster).not.toBeNull();

    const { triggerCharmMonster } = await import('../../services/rules/features/charmMonsterService.js');

    await act(async () => {
      await result.current.handleCharmMonsterConfirm(['Goblin A']);
    });

    expect(triggerCharmMonster).toHaveBeenCalledWith(
      spell,
      expect.objectContaining({ charmMonsterTargets: ['Goblin A'], characters: [] }),
      expect.objectContaining({ name: 'TestSorcerer' }),
      CAMPAIGN,
      null,
    );
    expect(result.current.pendingCharmMonster).toBeNull();
  });
});

describe('useSpellMetamagicFlow — Healing Word confirm lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('threads the object target with the paid slot level to triggerHealingWord and clears pending', async () => {
    const { result, spell } = await renderGated({ name: 'Healing Word', level: 1, casting_time: '1 bonus action' });

    expect(result.current.pendingHealingWord).not.toBeNull();

    const { triggerHealingWord } = await import('../../services/rules/features/healingWordService.js');

    await act(async () => {
      await result.current.handleHealingWordConfirm({ targetName: 'Goblin A' });
    });

    // runHealingWord builds metaCtx via healSlotLevel (no upcast → base level 1)
    expect(triggerHealingWord).toHaveBeenCalledWith(
      spell,
      { targetName: 'Goblin A', slotLevel: 1 },
      expect.objectContaining({ name: 'TestSorcerer' }),
      CAMPAIGN,
      null,
    );
    expect(result.current.pendingHealingWord).toBeNull();
  });

  it('does not trigger healing without a selected target', async () => {
    const { result } = await renderGated({ name: 'Healing Word', level: 1, casting_time: '1 bonus action' });

    const { triggerHealingWord } = await import('../../services/rules/features/healingWordService.js');

    await act(async () => {
      await result.current.handleHealingWordConfirm({});
    });

    expect(triggerHealingWord).not.toHaveBeenCalled();
    expect(result.current.pendingHealingWord).toBeNull();
  });
});

describe('useSpellMetamagicFlow — Heal confirm lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes the object target to triggerHeal at the pending spell level and clears pending', async () => {
    const { result } = await renderGated({ name: 'Heal', level: 6, range: '60 feet' });

    expect(result.current.pendingHeal).not.toBeNull();

    const { triggerHeal } = await import('../../services/rules/features/healService.js');

    await act(async () => {
      await result.current.handleHealConfirm({ targetName: 'Goblin A' });
    });

    // runHeal wraps { name, spell, level: pending.spellLevel } for the trigger
    expect(triggerHeal).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Heal', level: 6 }),
      { targetName: 'Goblin A' },
      expect.objectContaining({ name: 'TestSorcerer' }),
      CAMPAIGN,
      null,
    );
    expect(result.current.pendingHeal).toBeNull();
  });

  it('does not heal without a selected target', async () => {
    const { result } = await renderGated({ name: 'Heal', level: 6, range: '60 feet' });

    const { triggerHeal } = await import('../../services/rules/features/healService.js');

    await act(async () => {
      await result.current.handleHealConfirm({});
    });

    expect(triggerHeal).not.toHaveBeenCalled();
    expect(result.current.pendingHeal).toBeNull();
  });
});

// Non-charm/heal routings with no happy-path test in any sibling file —
// parked here until the spells lanes claim them (they run the same
// SIMPLE_SPELL_SPECS infra asserted above).
describe('useSpellMetamagicFlow — retained unique confirm routings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const routings = [
    {
      spell: { name: 'Prismatic Spray', level: 7, range: 'Self' },
      pending: 'pendingPrismaticSpray',
      handler: 'handlePrismaticSprayConfirm',
      arg: ['Goblin A'],
      // prismatic_spray spec: run = onExecute(spell, { selectedTargets })
      assert: ({ onExecute, spell }) => expect(onExecute).toHaveBeenCalledWith(spell, { selectedTargets: ['Goblin A'] }),
    },
    {
      spell: { name: 'Protection from Evil and Good', level: 1, range: 'Touch' },
      pending: 'pendingProtectionFromEvilAndGood',
      handler: 'handleProtectionFromEvilAndGoodConfirm',
      arg: ['Goblin A'],
      // consumeThenApply spec: holy-water material is consumed, then apply runs
      assert: async ({ playerStats }) => {
        const automation = await import('../../services/automation/index.js');
        const { consumeMaterial } = await import('../../services/rules/spells/materialComponents.js');
        expect(consumeMaterial).toHaveBeenCalledWith(playerStats, 'Flask of Holy Water (25 gp)', CAMPAIGN);
        expect(automation.applyProtectionFromEvilAndGood).toHaveBeenCalledTimes(1);
      },
    },
  ];

  for (const tc of routings) {
    it(`${tc.spell.name} confirm applies its effect and clears pending`, async () => {
      const { result, onExecute, spell, playerStats } = await renderGated(tc.spell);

      expect(result.current[tc.pending]).not.toBeNull();

      await act(async () => {
        await result.current[tc.handler](tc.arg);
      });

      await tc.assert({ onExecute, spell, playerStats });
      expect(result.current[tc.pending]).toBeNull();
    });
  }
});

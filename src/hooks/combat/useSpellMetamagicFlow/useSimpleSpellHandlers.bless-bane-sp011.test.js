// @maintained-by-ai: 2026-10-22
// SP-011 bless/bane twin-spec lane (#1340): the bless spec (useSimpleSpellHandlers.js:288)
// must forward the paid slot level exactly like its bane twin (:287) —
// `level: p.metaCtx?.slotLevel || p.spellLevel` (stampPaidSlotLevel / CLA-086 seam).
// Consumption proof, both legs, in this one file: applySpell (:54) spreads bodyOf(pending)
// onto the action object and passes it as the service's `spell` arg; blessService
// .applyBlessEffect (:38, UNMOCKED here) reads spell.level || 1 → te stamp (:49 slotLevel)
// and both cast logs (:70/:82 spellLevel). Pre-fix, a metamagic-upcast Bless forwarded no
// level, so the service defaulted it and stamped slotLevel:1 + logged lv1. The bane twin
// is pinned byte-intact (#1348 twin table). blessService.test.js:17-21 owns the service-side
// seam that awaited this wiring fix; this lane owns the hook-side forwarding contract.
// casting_time stays unblessed-forwarded: blessService :71/:83 '1 action' fallback matches
// the disk RAW row — byte-intact here, diff noted in #1340 summary.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells5e from '../../../../public/data/spells.json';
import { getEffectDefinition } from '../../../services/combat/conditions/targetEffectDefinitions.js';

// Auto-mocks neutralize every heavy runner dependency imported by the hook
// (animalFriendship lane recipe). automation/index.js automock gives capture
// spies for applyBlessEffect/applyBaneEffect; its executeHandler stub also
// satisfies blessService's module-level import (never invoked on the apply path).
vi.mock('../../../services/automation/index.js');
vi.mock('../../../services/rules/features/faerieFireService.js');
vi.mock('../../../services/rules/features/healService.js');
vi.mock('../../../services/rules/features/foresightService.js');
vi.mock('../../../services/rules/features/holdMonsterService.js');
vi.mock('../../../services/rules/features/charmPersonService.js');
vi.mock('../../../services/rules/features/charmMonsterService.js');
vi.mock('../../../services/rules/features/banishmentService.js');
vi.mock('../../../services/rules/features/revivifyService.js');
vi.mock('../../../services/rules/features/healingWordService.js');
vi.mock('../../../services/automation/handlers/spells/polymorphService.js');
vi.mock('../../../services/rules/features/greaterRestorationService.js');
vi.mock('../../../services/rules/features/removeCurseService.js');
vi.mock('../../../services/rules/features/regenerateService.js');
vi.mock('../../../services/rules/spells/materialComponents.js');
vi.mock('../../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../useConfirmableFlow.js', () => ({ rollbackSpellSlot: vi.fn() }));
vi.mock('../../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => []),
  setRuntimeValue: vi.fn(),
}));

import { useSimpleSpellHandlers } from './useSimpleSpellHandlers.js';
import { applyBlessEffect, applyBaneEffect, executeHandler } from '../../../services/automation/index.js';
import { applyBlessEffect as realApplyBlessEffect } from '../../../services/rules/features/blessService.js';
import { setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

const CAMPAIGN_NAME = 'test-campaign';
const CASTER = 'Cleric';
const DISK_BLESS = spells5e.find(s => s.name === 'Bless');
const DISK_BANE = spells5e.find(s => s.name === 'Bane');
const BLESS_TE = getEffectDefinition('bless_bonus').effect;

function setupRunners() {
  const runs = {};
  const buildHandlers = useSimpleSpellHandlers; // pure factory — no React hooks inside
  buildHandlers({
    createConfirmHandler: (name, applyFn) => { runs[name] = applyFn; return vi.fn(); },
    createSkipHandler: () => vi.fn(),
    playerStats: { name: CASTER },
    campaignName: CAMPAIGN_NAME,
    setPopupHtml: vi.fn(),
    getPending: () => null,
    cfClearPending: vi.fn(),
    onExecute: vi.fn(),
  });
  return runs;
}

// Fixture mirrors what the specs actually read: spell, spellLevel, metaCtx,
// range, maxTargets, castingTime (paid-slot shape per stampPaidSlotLevel).
function makePending(spell, overrides = {}) {
  return {
    spellName: spell.name,
    spell: { ...spell },
    spellLevel: 1,
    range: spell.range,
    maxTargets: 3,
    castingTime: spell.casting_time,
    metaCtx: {},
    ...overrides,
  };
}

describe('SP-011 bless spec (#1340) — paid-slot forwarding, hook -> blessService both legs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lv3 upcast forwards action.level 3 (metaCtx.slotLevel wins)', async () => {
    const runs = setupRunners();
    // Disk ladder (spells.json Bless higher_level): +1 target per slot above 1 → 5 at lv3.
    await runs.bless(makePending(DISK_BLESS, { metaCtx: { slotLevel: 3 }, maxTargets: 5 }), ['Goblin']);

    expect(applyBlessEffect).toHaveBeenCalledTimes(1);
    expect(executeHandler).not.toHaveBeenCalled();
    const action = applyBlessEffect.mock.calls[0][0];
    expect(action.level).toBe(3);
    expect(action.automation).toEqual({ type: 'bless', range: '30 feet', maxTargets: 5 });
    expect(action.spell).toEqual({ ...DISK_BLESS });
    expect(applyBlessEffect.mock.calls[0][1]).toEqual({ name: CASTER });
    expect(applyBlessEffect.mock.calls[0][2]).toBe(CAMPAIGN_NAME);
    expect(applyBlessEffect.mock.calls[0][3]).toBeNull();
    expect(applyBlessEffect.mock.calls[0][4]).toEqual(['Goblin']);
  });

  it('lv3 upcast end-to-end through REAL blessService: te rows slotLevel 3 + both logs spellLevel 3', async () => {
    // Consumption proof: the captured action is fed unmodified to the unmocked
    // blessService.applyBlessEffect — the same function automation/index.js re-exports.
    const runs = setupRunners();
    await runs.bless(makePending(DISK_BLESS, { metaCtx: { slotLevel: 3 }, maxTargets: 5 }), ['Goblin', 'Orc']);
    const action = applyBlessEffect.mock.calls[0][0];

    await realApplyBlessEffect(action, { name: CASTER }, CAMPAIGN_NAME, null, ['Goblin', 'Orc']);

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    const [scope, key, effects, campaign, skipSync] = setRuntimeValue.mock.calls[0];
    expect(scope).toBe('campaign');
    expect(key).toBe('targetEffects');
    expect(campaign).toBe(CAMPAIGN_NAME);
    expect(skipSync).toBe(true);
    expect(effects).toEqual([
      { target: 'Goblin', effect: BLESS_TE, source: CASTER, slotLevel: 3, duration: 'concentration' },
      { target: 'Orc', effect: BLESS_TE, source: CASTER, slotLevel: 3, duration: 'concentration' },
    ]);
    expect(addEntry).toHaveBeenCalledTimes(2);
    const [castEntry, summaryEntry] = addEntry.mock.calls.map(c => c[1]);
    expect(castEntry).toEqual({
      type: 'spell',
      characterName: CASTER,
      targetName: 'Goblin',
      targets: ['Goblin', 'Orc'],
      spellName: 'Bless',
      spellLevel: 3,
      castingTime: '1 action',
      description: 'Cleric casts Bless on Goblin, Orc.',
      timestamp: expect.any(Number),
    });
    expect(summaryEntry).toEqual({
      type: 'spell',
      characterName: CASTER,
      targetName: 'Goblin',
      targets: ['Goblin', 'Orc'],
      spellName: 'Bless',
      spellLevel: 3,
      castingTime: '1 action',
      description: 'Bless cast: 2 creature(s) blessed.',
      timestamp: expect.any(Number),
    });
  });

  it('lv1 base arm byte-intact: level 1 forwarded, te slotLevel 1 + logs lv1', async () => {
    const runs = setupRunners();
    await runs.bless(makePending(DISK_BLESS), ['Goblin']);
    const action = applyBlessEffect.mock.calls[0][0];
    expect(action.level).toBe(1);
    expect(action.automation).toEqual({ type: 'bless', range: '30 feet', maxTargets: 3 });

    await realApplyBlessEffect(action, { name: CASTER }, CAMPAIGN_NAME, null, ['Goblin']);
    expect(setRuntimeValue.mock.calls[0][2]).toEqual([
      { target: 'Goblin', effect: BLESS_TE, source: CASTER, slotLevel: 1, duration: 'concentration' },
    ]);
    expect(addEntry.mock.calls.map(c => c[1].spellLevel)).toEqual([1, 1]);
    expect(addEntry.mock.calls[1][1].description).toBe('Bless cast: 1 creature(s) blessed.');
  });

  it('metaCtx absent falls back to pending.spellLevel (2)', async () => {
    const runs = setupRunners();
    await runs.bless(makePending(DISK_BLESS, { metaCtx: undefined, spellLevel: 2, maxTargets: 4 }), ['Goblin']);

    expect(applyBlessEffect.mock.calls[0][0].level).toBe(2);
  });

  it('bane twin byte-intact (#1348 table): exact full action incl. level + casting_time', async () => {
    const runs = setupRunners();
    await runs.bane(makePending(DISK_BANE, { metaCtx: { slotLevel: 2 }, maxTargets: 4 }), ['Goblin']);

    expect(applyBaneEffect).toHaveBeenCalledTimes(1);
    expect(applyBaneEffect.mock.calls[0][0]).toEqual({
      name: 'Bane',
      spell: { ...DISK_BANE },
      automation: { type: 'bane', range: '30 feet', maxTargets: 4 },
      level: 2,
      casting_time: '1 action',
    });
  });
});

describe('data-drift guard — spells.json Bless/Bane rows the twin contract assumes', () => {
  it('Bless lv1 Enchantment, concentration up to 1 minute, +1 target per slot above 1st', () => {
    expect(DISK_BLESS.level).toBe(1);
    expect(DISK_BLESS.concentration).toBe(true);
    expect(DISK_BLESS.duration).toBe('Up to 1 minute');
    expect(DISK_BLESS.casting_time).toBe('1 action');
    expect(DISK_BLESS.higher_level[0]).toBe(
      'When you cast this spell using a spell slot of 2nd level or higher, you can target one additional creature for each slot level above 1st.'
    );
  });

  it('Bane lv1 Enchantment keeps the twin ladder the bane pin assumes', () => {
    expect(DISK_BANE.level).toBe(1);
    expect(DISK_BANE.duration).toBe('Up to 1 minute');
    expect(DISK_BANE.higher_level[0]).toBe(
      'When you cast this spell using a spell slot of 2nd level or higher, you can target one additional creature for each slot level above 1st.'
    );
  });
});

// @maintained-by-ai: 2026-10-15
//
// ROLLBACK EDGE PATHS — spell-specific custom lanes NOT in the skip.test.js authority table.
// Owns the money/log semantics of the two custom confirm lanes that bypass
// createSkipHandler (useCustomHandlers.js):
//  - Protection from Poison (SP-095): gate arms UNPAID → skip LOGS but refunds NO slot
//    ("logged-but-unpaid", a third shape between skip.test.js 'refund' and 'clear' lanes);
//    confirm guards BEFORE the log, so an empty payload moves no money and leaves no entry.
//  - Stone Skin: skipped AFTER the gate armed paid → rolls back the RAW lv4 slot
//    (2024 Essentials: not in 5e spells.json) at the exact key, and consumes no material.
//  - Revivify confirm with no target (RAW lv3): the createConfirmHandler wrapper logs
//    BEFORE the inner runRevivify guard — log fires, spell never applies. Pinned against
//    revivifyRefusal.test.js (refusal refund) and skip.test.js (revivify skip refund).
// Owned elsewhere and removed as duplicates here: two-stage initial stages + Enhance Ability
// ability guard (gate-two-stage.test.js, useTwoStageHandlers.enhanceAbility.test.js),
// Sanctuary / Sleet Storm confirm + skip dispatch (simple-handlers.test.js SPELL_ROWS),
// un-armed handler guards (handler-guards.test.js), pay-at-confirm 'clear' lane
// (skip.test.js), upcast refunds (cla086 lane).
// Levels/casting times verified against public/data/spells.json + public/data/2024/spells.json 2026-10-15.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { setRuntimeValue } from '../runtime/useRuntimeState.js';
import { applyProtectionFromPoisonHandler, applyStoneSkinHandler } from '../../services/automation/index.js';
import { consumeMaterial } from '../../services/rules/spells/materialComponents.js';
import { triggerRevivify } from '../../services/rules/features/revivifyService.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  // CLA-033/CLA-037: fired by the confirm lane's rider seam in useConfirmableFlow.
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
}));

// Goblin C is dead so the SP-100 Revivify dead-target gate arms pending.
vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      { name: 'Goblin C', type: 'monster', currentHp: 0 },
    ],
  })),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve(null)),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
  handleSanctuary: vi.fn(() => Promise.resolve(null)),
  executeHandler: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

// Runtime slot mock: available = 3 at every level → a refund lands as
// setRuntimeValue(name, 'spell_slots_level_N', 4, campaign).
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

global.fetch = vi.fn((url) => {
  if (url && url.includes('combat-summary')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ creatures: [] }),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });
});

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

const CAMPAIGN = 'TestCampaign';
const CASTER = 'TestSorcerer';

function renderFlow(onExecute = vi.fn()) {
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: { name: CASTER, class: { name: 'Sorcerer' }, level: 5 },
      campaignName: CAMPAIGN,
      onExecute,
      setSecondaryTargetModal: null,
      characters: [],
      setPopupHtml: vi.fn(),
    })
  );
  return { result, onExecute };
}

async function gateSpell(result, spell) {
  await act(async () => {
    await result.current.gateMetamagic(spell);
  });
}

const slotWrites = () => setRuntimeValue.mock.calls.filter(c => String(c[1]).includes('spell_slots'));

describe('useSpellMetamagicFlow — custom-lane skip money semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Protection from Poison skip: logs the cast but refunds no slot (SP-095 pay-at-confirm)', async () => {
    const { result } = renderFlow();
    // spells.json: lv2, 1 action, Touch. The gate never spends the slot —
    // consumeProtectionFromPoisonSlot pays it at confirm — so skip must not
    // write any spell_slots rollback (that would inflate slots above max).
    const spell = { name: 'Protection from Poison', level: 2, casting_time: '1 action', range: 'Touch' };
    await gateSpell(result, spell);
    expect(result.current.pendingProtectionFromPoison).not.toBeNull();

    act(() => {
      result.current.handleProtectionFromPoisonSkip();
    });

    expect(result.current.pendingProtectionFromPoison).toBeNull();
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'spell',
      characterName: CASTER,
      spellName: 'Protection from Poison',
      spellLevel: 2,
      castingTime: '1 action',
    }));
    expect(slotWrites()).toHaveLength(0);
    expect(applyProtectionFromPoisonHandler).not.toHaveBeenCalled();
  });

  it('Stone Skin skip: logs the cast and refunds the lv4 slot at the exact key', async () => {
    const { result } = renderFlow();
    // 2024 Essentials spells.json: lv4, Action, Touch (Stone Skin is not in 5e data).
    // This custom handler pays its own money, so skip rolls back — unlike the
    // SP-095 lane above. Mocked available = 3 → refund lands as level_4 = 4.
    const spell = { name: 'Stone Skin', level: 4, casting_time: 'Action', range: 'Touch' };
    await gateSpell(result, spell);
    expect(result.current.pendingStoneSkin).not.toBeNull();
    // The gate never consumes material — so skipping must return none either.
    expect(consumeMaterial).not.toHaveBeenCalled();

    act(() => {
      result.current.handleStoneSkinSkip();
    });

    expect(result.current.pendingStoneSkin).toBeNull();
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'spell',
      characterName: CASTER,
      spellName: 'Stone Skin',
      spellLevel: 4,
      castingTime: 'Action',
    }));
    expect(setRuntimeValue).toHaveBeenCalledWith(CASTER, 'spell_slots_level_4', 4, CAMPAIGN);
    expect(applyStoneSkinHandler).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — confirm guards on empty payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const empty of [[], {}]) {
    it(`Protection from Poison confirm with ${JSON.stringify(empty)}: guard runs BEFORE the log — no money, no entry, pending cleared`, async () => {
      const { result, onExecute } = renderFlow();
      await gateSpell(result, { name: 'Protection from Poison', level: 2, casting_time: '1 action', range: 'Touch' });

      await act(async () => {
        await result.current.handleProtectionFromPoisonConfirm(empty);
      });

      expect(onExecute).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(applyProtectionFromPoisonHandler).not.toHaveBeenCalled();
      expect(slotWrites()).toHaveLength(0);
      expect(result.current.pendingProtectionFromPoison).toBeNull();
    });
  }

  it('Revivify confirm with no targetName: wrapper logs BEFORE the inner guard fires, spell never applies', async () => {
    const { result, onExecute } = renderFlow();
    // spells.json: lv3, 1 action, Touch. createConfirmHandler clears pending and
    // logs (targets fall back to the dead picker list) before runRevivify's
    // targetName guard early-returns — the inverse ordering of the PfP guard above.
    await gateSpell(result, { name: 'Revivify', level: 3, casting_time: '1 action', range: 'Touch' });
    expect(result.current.pendingRevivify).not.toBeNull();

    await act(async () => {
      await result.current.handleRevivifyConfirm({});
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(triggerRevivify).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'spell',
      characterName: CASTER,
      spellName: 'Revivify',
      spellLevel: 3,
    }));
    expect(result.current.pendingRevivify).toBeNull();
  });
});

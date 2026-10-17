// @maintained-by-ai
// #1903 dominateHandler.person — NAME-VARIANT lane closing the dominate trio
// (#1901 beast / #1902 monster / THIS person). Internals canon lives in
// dominateHandler.beast.test.js (read its header first): cast seam keys, effects latch,
// charmed dedup, ?? 0 ledger defaults, missing-automation {} default, heighten transport
// and rollNpcSave delegation (pair #1884/#1885) are NOT re-run here.
//
// Like #1902, handleDominate branches on the spell name NOWHERE (automation/index.js:553
// maps dominate_person to the same one handler); this file pins only the person-name
// plumbing, which grep-verified 2026-10-16 is unique in-suite: 'save-dominate-person'
// (derived at dominateHandler.js:48/:99) and the '[Dominate Person] Error:' console
// prefix (:54/:94/:104/:164) appear in no other test file.
//
// Caller-shape note vs #1902's unique find: the REAL trigger hop — triggerSpells.js:302-306
// handleDominatePerson + checkCompelledDuelAttackExpiry → dominatePersonService
// .triggerDominatePerson (dominatePersonService.js:92-102) — builds a shell with the SAME
// saveType-less shape as the monster service shell ({type, saveDc, targetName, advantage};
// its spell/spellSlotLevel extras are pinned by dominatePersonService.test.js:235-249,
// service lane). So the saveType-less discovery is #1902's, NOT re-claimed here. What
// neither sibling disambiguated: both fed automation.targetName='Goblin' identical to
// resolveTarget's pick, so "prompt target comes from resolveTarget, not automation
// .targetName" was never actually proven. This lane is the trio's honest disambiguation:
// the shell carries a DIFFERENT targetName and the handler must still prompt Goblin.
// Seam notes:
// - buildSaveDc stubbed to 18 (≠ shell saveDc 15, ≠ beast 16, ≠ monster 17) — DC trap
//   proves the source is buildSaveDc, not action.automation.saveDc.
// - Turn-based: all writes are cast-time only; no timers, no wall-clock decay.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  rollSaveForCreature: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}));

import { handle } from './dominateHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { storeSpellLastAttack } from '../../common/damageRollback.js';

const campaignName = 'test-campaign';
// 18 ≠ service-shell saveDc 15 → pins that DC flows from buildSaveDc (trio DC trap).
const DC = 18;

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

// Real dominatePersonService.js:92-102 shell shape (saveType ABSENT, like #1902's monster
// discovery — not re-claimed) with a DECOY automation.targetName so the resolveTarget
// precedence below is genuinely disambiguated for the trio.
function makeServiceShell(automation = {}) {
  return {
    name: 'Dominate Person',
    automation: { type: 'dominate_person', saveDc: 15, targetName: 'Decoy Villager', advantage: false, ...automation },
  };
}

function setupBaseMocks(saveResult = { success: true }) {
  resolveTarget.mockResolvedValue({
    target: { name: 'Goblin', type: 'player' },
    cs: { creatures: [{ name: 'Goblin', type: 'player', saveBonuses: { WIS: 2 } }] },
  });
  buildSaveDc.mockReturnValue(DC);
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

describe('dominateHandler.handle (Dominate Person — name-variant lane, trio close)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('success cast on the real service shell: resolveTarget beats decoy automation.targetName; unique save-dominate-person rollType + own-name strings', async () => {
    setupBaseMocks({ success: true, roll: 12, total: 17 });

    const result = await handle(makeServiceShell(), makePlayerStats(), campaignName, null);

    // Shell reaches buildSaveDc byte-identical (no saveType); DC trap 18 ≠ 15.
    expect(buildSaveDc).toHaveBeenCalledWith(
      { type: 'dominate_person', saveDc: 15, targetName: 'Decoy Villager', advantage: false },
      expect.any(Object),
    );
    // Trio disambiguation: prompt/ledger target is resolveTarget's Goblin, never the
    // shell's Decoy Villager; saveType 'WIS' is the handler's hardcode.
    expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      attackerName: 'TestCaster',
      saveType: 'WIS',
      saveDc: DC,
      dcSuccess: 'none',
      advantage: false,
      disadvantage: false,
      condition: 'charmed',
    });
    expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      spellName: 'Dominate Person',
      saveType: 'WIS',
      saveDc: DC,
    }));
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestCaster',
      abilityName: 'Dominate Person',
      description: 'TestCaster casts Dominate Person on Goblin! Goblin must make a WIS save (DC 18) or become Charmed.',
      promptId: 'test-prompt-id',
    });
    // Unique person-lane rollType + own-name success prose.
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dominate Person',
        description: 'Goblin succeeded on WIS save (DC 18) against Dominate Person. Roll: 12 + 0 = 17.',
      },
    });
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'save_result',
      characterName: 'TestCaster',
      rollType: 'save-dominate-person',
      targetName: 'Goblin',
      saveDc: DC,
      saveType: 'WIS',
      success: true,
      description: 'Goblin succeeded on WIS save against Dominate Person.',
    });
  });

  it('failed-save prose derives the person name: rollType, reason, popup full strings', async () => {
    setupBaseMocks({ success: false, roll: 5, total: 7 });
    getRuntimeValue.mockReturnValue([]);

    const result = await handle(makeServiceShell(), makePlayerStats(), campaignName, null);

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'save_result',
      rollType: 'save-dominate-person',
      success: false,
      description: 'Goblin failed WIS save against Dominate Person and is Charmed.',
    }));
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'condition',
      action: 'applied',
      characterName: 'Goblin',
      condition: 'Charmed',
      reason: 'Dominate Person spell',
    }));
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dominate Person',
        description: 'Goblin failed WIS save (DC 18) against Dominate Person. Roll: 5 + 0 = 7 — Goblin is Charmed by TestCaster. You have a telepathic link with the target and can issue commands to it (no action required). The spell ends if concentration is lost, on initiative roll, short rest, or long rest.',
      },
    });
    // Charm mechanics themselves (dedup, latch, single-write count) are #1901 canon —
    // only the person-name identity of the write is evidence-checked here.
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['charmed'], campaignName);
  });

  it('no-target early return still carries the spell name', async () => {
    resolveTarget.mockResolvedValue(null);

    const result = await handle(makeServiceShell(), makePlayerStats(), campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dominate Person',
        description: 'No target selected. Dominate has no effect.',
      },
    });
    expect(createSaveListener).not.toHaveBeenCalled();
  });

  it('log rejection console prefix is [Dominate Person]: caught, cast proceeds', async () => {
    setupBaseMocks({ success: false });
    getRuntimeValue.mockReturnValue([]);
    addEntry.mockImplementation((campaign, entry) => (
      entry.type === 'ability_use' ? Promise.reject(new Error('log write failed')) : Promise.resolve()
    ));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await handle(makeServiceShell(), makePlayerStats(), campaignName, null);

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('[Dominate Person] Error:', expect.any(Error));
    });
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Goblin');
    consoleSpy.mockRestore();
  });
});

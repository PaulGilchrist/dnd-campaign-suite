// @maintained-by-ai
// #1902 dominateHandler.monster — NAME-VARIANT lane of the dominate trio
// (#1901 beast / THIS monster / #1903 person). Internals canon lives in
// dominateHandler.beast.test.js (read its header first): cast seam, createSaveListener
// keys, effects latch, dedup, DC provenance, rollNpcSave delegation (pair #1884/#1885)
// are NOT re-run here.
//
// Verified honestly at source (2026-10-16): handleDominate branches on beast vs monster
// vs person NOWHERE — automation/index.js:551-553 maps all three keys to the one handler
// and every flavored string derives from action.name / the automation shell:
// rollType `save-${spellName.toLowerCase().replace(/\s+/g,'-')}` (dominateHandler.js:48
// /:99 → 'save-dominate-monster'), condition reason `${spellName} spell` (:91),
// console prefix `[${spellName}] Error:` (:54/:94/:104/:164). This file therefore exists
// ONLY to pin the monster-name plumbing, which is unique in-suite: 'save-dominate-monster'
// appears in no other test file, and '[Dominate Monster] Error:' was pinned nowhere.
//
// Monster caller-shape variant (vs the beast shell, which carries saveType): the REAL
// trigger hop — triggerSpells.js:291-293 handleDominateMonster +
// checkCompelledDuelAttackExpiry → dominateMonsterService.triggerDominateMonster
// (dominateMonsterService.js:38-48) — builds the automation shell WITHOUT saveType
// ({type, saveDc, targetName, advantage}). Pinned here once: the handler still hardcodes
// saveType:'WIS' at prompt/ledger/rollback, and the prompt target comes from resolveTarget,
// not automation.targetName. Service-side gating is dominateMonsterService.test.js.
// Seam notes:
// - buildSaveDc stubbed to 17 (≠ service shell saveDc 15) so every DC pin proves the
//   source is buildSaveDc, not action.automation.saveDc (DC trap pattern).
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
// 17 ≠ service-shell saveDc 15 → pins that DC flows from buildSaveDc.
const DC = 17;

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

// Exact shell shape built by dominateMonsterService.js:38-48 — note the ABSENT saveType
// (the beast lane's shell includes it), and automation.targetName the handler ignores.
function makeServiceShell(automation = {}) {
  return {
    name: 'Dominate Monster',
    automation: { type: 'dominate_monster', saveDc: 15, targetName: 'Goblin', advantage: false, ...automation },
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

describe('dominateHandler.handle (Dominate Monster — name-variant lane)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveType-less monster service shell: exact cast seam, WIS hardcoded, monster-name full strings', async () => {
    setupBaseMocks({ success: true, roll: 12, total: 17 });

    const result = await handle(makeServiceShell(), makePlayerStats(), campaignName, null);

    // Shell reaches buildSaveDc byte-identical (no saveType), DC trap 17 ≠ 15.
    expect(buildSaveDc).toHaveBeenCalledWith(
      { type: 'dominate_monster', saveDc: 15, targetName: 'Goblin', advantage: false },
      expect.any(Object),
    );
    // Prompt target is resolveTarget's, not automation.targetName; saveType 'WIS' is the
    // handler's hardcode, disambiguated for the trio only through this saveType-less shell.
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
    expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
      casterName: 'TestCaster',
      spellName: 'Dominate Monster',
      saveType: 'WIS',
      saveDc: DC,
      attackScope: 'single',
    });
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestCaster',
      abilityName: 'Dominate Monster',
      description: 'TestCaster casts Dominate Monster on Goblin! Goblin must make a WIS save (DC 17) or become Charmed.',
      promptId: 'test-prompt-id',
    });

    // Success leg monster-name plumbing: unique rollType + own-name popup/prose.
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dominate Monster',
        description: 'Goblin succeeded on WIS save (DC 17) against Dominate Monster. Roll: 12 + 0 = 17.',
      },
    });
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'save_result',
      characterName: 'TestCaster',
      rollType: 'save-dominate-monster',
      targetName: 'Goblin',
      saveDc: DC,
      saveType: 'WIS',
      success: true,
      description: 'Goblin succeeded on WIS save against Dominate Monster.',
    });
  });

  it('failed-save prose derives the monster name: rollType, reason, popup full strings', async () => {
    setupBaseMocks({ success: false, roll: 5, total: 7 });
    getRuntimeValue.mockReturnValue([]);

    const result = await handle(makeServiceShell(), makePlayerStats(), campaignName, null);

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'save_result',
      rollType: 'save-dominate-monster',
      success: false,
      description: 'Goblin failed WIS save against Dominate Monster and is Charmed.',
    }));
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'condition',
      action: 'applied',
      characterName: 'Goblin',
      condition: 'Charmed',
      reason: 'Dominate Monster spell',
    }));
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dominate Monster',
        description: 'Goblin failed WIS save (DC 17) against Dominate Monster. Roll: 5 + 0 = 7 — Goblin is Charmed by TestCaster. You have a telepathic link with the target and can issue commands to it (no action required). The spell ends if concentration is lost, on initiative roll, short rest, or long rest.',
      },
    });
    // Charm mechanics themselves (dedup, latch shape, single-write count) are #1901 canon —
    // only the monster-name identity of the write is checked here.
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['charmed'], campaignName);
  });

  it('no-target early return still carries the spell name', async () => {
    resolveTarget.mockResolvedValue(null);

    const result = await handle(makeServiceShell(), makePlayerStats(), campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dominate Monster',
        description: 'No target selected. Dominate has no effect.',
      },
    });
    expect(createSaveListener).not.toHaveBeenCalled();
  });

  it('log rejection console prefix is [Dominate Monster]: caught, cast proceeds', async () => {
    setupBaseMocks({ success: false });
    getRuntimeValue.mockReturnValue([]);
    addEntry.mockImplementation((campaign, entry) => (
      entry.type === 'ability_use' ? Promise.reject(new Error('log write failed')) : Promise.resolve()
    ));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await handle(makeServiceShell(), makePlayerStats(), campaignName, null);

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('[Dominate Monster] Error:', expect.any(Error));
    });
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Goblin');
    consoleSpy.mockRestore();
  });
});

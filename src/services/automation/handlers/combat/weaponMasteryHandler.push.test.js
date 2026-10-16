// @maintained-by-ai
// WM-004: Push weapon mastery lane — owns applyPushMastery (weaponMasteryHandler.js ~:277):
// size-gate delegation to MN-015 validateSizeLimit, direct instant push te write
// (bypasses registerTargetEffect by design — mirrors shieldBash), own-composed
// accept/refusal ability_use logs, popup envelope.
// Lane boundaries:
// - Description strings owned by weaponMasteryHandler.description.test.js — the popup
//   here pins delegation to buildMasteryDescription output, never re-pins its text.
// - Size resolution precedence (monster data → combatSummary fallback) canonically lives
//   in validateSizeLimit.mn015.test.js — only the accept/refuse branch behaviour of
//   applyPushMastery is pinned here, so the fallback-miss smoke test was removed.
// - Registry internals owned by targetEffectDefinitions.test.js — only the existence of
//   the 'push' te key is pinned here (cross-module contract its generic loops cannot
//   catch: a dropped entry just shrinks the loop). label/group pins removed.
// Does not import applyPostDamageMasteryEffects (postDamage lane — disjoint).
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyMasteryEffect, MASTERY_EFFECTS, buildMasteryDescription } from './weaponMasteryHandler.js';
import { getEffectDefinition } from '../../../combat/conditions/targetEffectDefinitions.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as monsterUtils from '../../../npcs/monsterUtils.js';
import * as combatData from '../../../../services/encounters/combatData.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
    getMonsterImageUrl: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
}));

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'DraconicDragon',
        size: 'Medium',
        ...overrides,
    };
}

function combatSummaryWith(targetName, size) {
    return { creatures: [{ name: targetName, size }] };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(combatData.getCurrentCombatRound).mockReturnValue(1);
    vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([]);
});

describe('MASTERY_EFFECTS Push entry', () => {
    it('pins the Push entry shape: instant 10 ft push, Large-or-smaller gate, no save', () => {
        expect(MASTERY_EFFECTS.Push).toMatchObject({
            effect: 'push',
            value: 10,
            sizeLimit: 'large_or_smaller',
        });
        expect(MASTERY_EFFECTS.Push.requiresSave).toBeUndefined();
    });

    it('push te key is registered in the target effect registry (internals owned by targetEffectDefinitions.test.js)', () => {
        expect(getEffectDefinition('push')).toBeDefined();
    });
});

describe('applyMasteryEffect Push', () => {
    it('accept path: writes instant push te verbatim, returns mastery_rider popup carrying buildMasteryDescription, logs ability_use', async () => {
        vi.mocked(damageUtils.getCombatContext).mockResolvedValue(combatSummaryWith('Thug 1', 'Medium'));
        vi.mocked(monsterUtils.getMonsterData).mockResolvedValue({ size: 'Medium' });

        const result = await applyMasteryEffect('Push', makePlayerStats(), campaignName, 'Thug 1');

        // Direct write (applyPushMastery bypasses registerTargetEffect): append to the
        // stored [] with the exact te shape consumers read.
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
            target: 'Thug 1',
            source: 'Push',
            option: 'Push',
            effect: 'push',
            value: 10,
            duration: 'instant',
        }], campaignName);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Push',
                // Delegation pin: the popup carries buildMasteryDescription's output —
                // its text is pinned exactly in the description lane.
                description: buildMasteryDescription('Push', 'Thug 1'),
                automation: { type: 'mastery_rider', masteries: ['Push'] },
            },
        });

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'DraconicDragon',
            abilityName: 'Push',
            description: 'DraconicDragon used Push on Thug 1 — pushed 10 feet straight away.',
            targetName: 'Thug 1',
        });
    });

    it('refuses a Huge target: no te write, refusal popup without rider, own refusal log', async () => {
        vi.mocked(damageUtils.getCombatContext).mockResolvedValue(combatSummaryWith('Hill Giant 1', 'Huge'));
        vi.mocked(monsterUtils.getMonsterData).mockResolvedValue({ size: 'Huge' });

        const result = await applyMasteryEffect('Push', makePlayerStats(), campaignName, 'Hill Giant 1');

        // No-side-effect guard: the size gate short-circuits before any write.
        const teWrites = vi.mocked(useRuntimeState.setRuntimeValue).mock.calls.filter(c => c[1] === 'targetEffects');
        expect(teWrites.length).toBe(0);

        expect(result.type).toBe('popup');
        expect(result.payload.name).toBe('Push');
        // Popup description delegates to validateSizeLimit's refusal composition.
        expect(result.payload.description).toContain('Huge');
        expect(result.payload.description).toContain('too large');
        expect(result.payload.automation).toBeUndefined();

        const logs = vi.mocked(logService.addEntry).mock.calls.map(c => c[1]);
        const refusal = logs.find(e => e.type === 'ability_use' && e.abilityName === 'Push');
        expect(refusal).toBeDefined();
        // Own composition pinned byte-exact up to the delegated validator segment.
        expect(refusal.description).toMatch(/^DraconicDragon attacked Hill Giant 1 with a Push weapon but did not push it — Push: /);
        expect(refusal.description).not.toContain('pushed 10 feet');
        expect(refusal.targetName).toBe('Hill Giant 1');
    });

    it('generic-path sibling intact: Slow writes speed_reduction te value 10 until start of next turn', async () => {
        const result = await applyMasteryEffect('Slow', makePlayerStats(), campaignName, 'Thug 1');

        expect(result.type).toBe('popup');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
            target: 'Thug 1',
            source: 'Slow',
            option: 'Slow',
            effect: 'speed_reduction',
            value: 10,
            duration: 'until_start_of_next_turn',
        }], campaignName);
    });
});

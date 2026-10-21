// @maintained-by-ai
// Unit tests for the Death Ward zero-HP interceptor consumed via applyDamage's
// ZERO_HP_INTERCEPTORS table. The cast/arming lane (buff application, target-selection
// popup, isDeathWardActive) is owned by src/services/automation/handlers/buffs/
// deathWardHandler.test.js — this file covers only consume-on-certain-death here.
// Disk canon (public/data/spells.json + data/2024): level 4, Touch, NOT concentration,
// duration "8 hours" — combat-scoped per duration policy; no clock is stored or read.
// Registry key 'death_ward' is defined in src/services/combat/conditions/
// targetEffectDefinitions.js. Deterministic: only stable service boundaries are mocked
// (runtime store, log service). Writes are 4-arg setRuntimeValue without skipSync —
// this runs inside applyDamage on a real player action, not an SSE echo, so the
// server-side broadcast is the intended behavior.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { checkDeathWard } from './deathWardService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../services/ui/logService.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

const CAMPAIGN_NAME = 'TestCampaign';

// Seed the runtime-store read table. Omitted keys return undefined, exercising the
// source's `rawConditions || []` fallback when 'activeConditions' is not provided.
function seedTable({ hitPoints = 20, buffs = [], conditions } = {}) {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return buffs;
        if (key === 'hitPoints') return hitPoints;
        if (key === 'activeConditions') return conditions;
        return undefined;
    });
}

const DEATH_WARD_BUFF = { name: 'Death Ward', effect: 'death_ward', sourceCharacter: 'Cleric1' };

describe('deathWardService.checkDeathWard', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        logService.addEntry.mockResolvedValue(undefined);
        runtimeState.getRuntimeValue.mockReturnValue(undefined);
    });

    it('does nothing and reports not-intercepted unless a buff matches name AND effect exactly', () => {
        const creature = { name: 'Fighter1', type: 'player', currentHp: 10 };
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        const noMatchSeeds = [
            [],
            null,
            'not-an-array',
            [{ name: 'Death Ward', effect: 'shield_of_faith' }],
            [{ name: 'Armor of Agathys', effect: 'death_ward' }],
        ];
        for (const buffs of noMatchSeeds) {
            seedTable({ buffs });
            expect(checkDeathWard(creature, {}, CAMPAIGN_NAME)).toEqual({ intercepted: false });
        }

        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(creature.currentHp).toBe(10);
        dispatchSpy.mockRestore();
    });

    it('restores a dying player to 1 HP, clears all dying state, consumes the buff, logs, and broadcasts', () => {
        const creature = { name: 'Fighter1', type: 'player', currentHp: 0 };
        seedTable({
            hitPoints: 20,
            buffs: [DEATH_WARD_BUFF, { name: 'Bless', effect: 'bless' }],
            conditions: ['Unconscious', 'poisoned'],
        });
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        const result = checkDeathWard(creature, { name: 'Fighter1' }, CAMPAIGN_NAME);

        expect(result).toEqual({ intercepted: true, finalDamage: 0, newHp: 1 });
        expect(creature.currentHp).toBe(1);

        // Exactly six writes: hp, conditions (case-insensitive unconscious removal,
        // others preserved), dying state reset, and buff consumed with others intact.
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(6);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Fighter1', 'currentHitPoints', 1, CAMPAIGN_NAME);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Fighter1', 'activeConditions', ['poisoned'], CAMPAIGN_NAME);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Fighter1', 'deathSaves', [false, false, false], CAMPAIGN_NAME);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Fighter1', 'deathFailures', [false, false, false], CAMPAIGN_NAME);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Fighter1', 'isDead', 0, CAMPAIGN_NAME);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Fighter1', 'activeBuffs', [{ name: 'Bless', effect: 'bless' }], CAMPAIGN_NAME);

        expect(logService.addEntry).toHaveBeenCalledTimes(2);
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
            type: 'hp_change',
            targetName: 'Fighter1',
            delta: 1,
            currentHp: 1,
            maxHp: 20,
            isUnconscious: false,
            sourceName: 'Death Ward',
        });
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
            type: 'ability_use',
            characterName: 'Cleric1',
            abilityName: 'Death Ward',
            description: 'Death Ward protected Fighter1 from death! They drop to 1 HP instead of 0. The spell ends.',
        });

        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        const event = dispatchSpy.mock.calls[0][0];
        expect(event).toBeInstanceOf(CustomEvent);
        expect(event.type).toBe('combat-summary-updated');
        dispatchSpy.mockRestore();
    });

    it('protects a non-player creature without local HP mutation, defaulting an uncredited caster to unknown', () => {
        const creature = { name: 'Goblin', type: 'monster' };
        seedTable({ buffs: [{ name: 'Death Ward', effect: 'death_ward' }] });

        const result = checkDeathWard(creature, {}, CAMPAIGN_NAME);

        expect(result).toEqual({ intercepted: true, finalDamage: 0, newHp: 1 });
        expect(creature.currentHp).toBeUndefined();

        // Missing activeConditions falls back to [] and is written back; buffs fully consumed.
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', [], CAMPAIGN_NAME);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs', [], CAMPAIGN_NAME);

        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
            type: 'hp_change',
            targetName: 'Goblin',
            delta: 1,
            currentHp: 1,
            maxHp: 20,
            isUnconscious: false,
            sourceName: 'Death Ward',
        });
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
            type: 'ability_use',
            characterName: 'unknown',
            abilityName: 'Death Ward',
            description: 'Death Ward protected Goblin from death! They drop to 1 HP instead of 0. The spell ends.',
        });
    });

    it('throws with prefixed error log and writes nothing when stored max HP is null or undefined', () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const creature = { name: 'Fighter1', type: 'player', currentHp: 0 };

        for (const missing of [null, undefined]) {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [DEATH_WARD_BUFF];
                if (key === 'hitPoints') return missing;
                return undefined;
            });

            expect(() => checkDeathWard(creature, {}, CAMPAIGN_NAME)).toThrowError(
                new Error('Death Ward: hitPoints not found for Fighter1'),
            );
        }

        expect(errSpy).toHaveBeenCalledWith('[applyDamage] Death Ward: hitPoints not found for Fighter1 in TestCampaign');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
        expect(creature.currentHp).toBe(0);
        errSpy.mockRestore();
    });
});

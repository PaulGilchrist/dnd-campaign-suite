import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import monsters from '../../../../public/data/monsters.json';
import { TARGET_EFFECT_DEFINITIONS, getEffectDefinition } from '../../combat/conditions/targetEffectDefinitions.js';
import { getHealingBlockEffect, isHealingBlocked } from './healingBlock.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { applyHealingToTarget } from './applyHealing.js';
import { applyHealingDirectly } from '../../automation/common/healingRoll.js';

const SLAAD = monsters.find(m => m.index === 'aberrant-spirit-slaad');
const CLAW = SLAAD.actions.find(a => a.name === 'Claw');

describe('MA-0016 no_healing te registration (registry rule)', () => {
    it('registers no_healing in targetEffectDefinitions', () => {
        const def = getEffectDefinition('no_healing');
        expect(def).toBeTruthy();
        expect(def.label).toBe("Can't Regain Hit Points");
        expect(def.group).toBe('Defensive');
        const labels = TARGET_EFFECT_DEFINITIONS.filter(d => d.group === 'Defensive').map(d => d.label);
        expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    });

    it('authors no_healing on the Aberrant Spirit (Slaad) Claw row', () => {
        expect(CLAW.hit_target_effect).toBe('no_healing');
        expect(CLAW.attack_bonus).toBeNull();
    });
});

describe('MA-0016 healingBlock gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('finds the te naming the target', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') {
                return [{ target: 'AasimarTest', effect: 'no_healing', source: 'Aberrant Spirit (Slaad) 1' }];
            }
            return null;
        });
        expect(getHealingBlockEffect('AasimarTest', 'test-campaign')).toMatchObject({ effect: 'no_healing' });
        expect(getHealingBlockEffect('FeyRanger', 'test-campaign')).toBeNull();
    });

    it('isHealingBlocked logs a refusal and returns the te', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') {
                return [{ target: 'AasimarTest', effect: 'no_healing', source: 'Aberrant Spirit (Slaad) 1' }];
            }
            return null;
        });
        expect(isHealingBlocked('AasimarTest', 'test-campaign', 9)).toMatchObject({ effect: 'no_healing' });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'automation',
            automationType: 'healing_blocked',
            characterName: 'AasimarTest',
            description: expect.stringContaining('can\'t regain Hit Points'),
        }));
    });

    it('passes through when no te or zero amount, no log', () => {
        expect(isHealingBlocked('AasimarTest', 'test-campaign', 9)).toBeNull();
        expect(isHealingBlocked('AasimarTest', 'test-campaign', 0)).toBeNull();
        expect(addEntry).not.toHaveBeenCalled();
    });
});

describe('MA-0016 consumer: canonical heal helpers refuse', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') {
                return [{ target: 'AasimarTest', effect: 'no_healing', source: 'Aberrant Spirit (Slaad) 1', duration: 'until_start_of_next_turn' }];
            }
            if (prop === 'currentHitPoints') return 100;
            if (prop === 'hitPoints') return 143;
            return null;
        });
    });

    it('applyHealingToTarget refuses with zero actualHeal and never writes HP', () => {
        const cs = { creatures: [{ name: 'AasimarTest', type: 'player', maxHp: 143 }] };
        const result = applyHealingToTarget(cs, 'AasimarTest', 20, 'test-campaign');
        expect(result).toMatchObject({ actualHeal: 0, oldHp: 100, newHp: 100, maxHp: 143 });
        expect(setRuntimeValue.mock.calls.some(c => c[1] === 'currentHitPoints')).toBe(false);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: 'healing_blocked' }));
    });

    it('applyHealingDirectly refuses (Second Wind / hit dice path)', () => {
        const result = applyHealingDirectly({ name: 'AasimarTest', hitPoints: 143 }, 'AasimarTest', 15, 'test-campaign');
        expect(result).toMatchObject({ actualHeal: 0, newHp: 100, maxHp: 143 });
        expect(setRuntimeValue.mock.calls.some(c => c[1] === 'currentHitPoints')).toBe(false);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: 'healing_blocked' }));
    });
});

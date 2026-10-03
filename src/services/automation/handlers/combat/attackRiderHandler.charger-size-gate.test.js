// FT-106: applyRiderOption size-gate — Charger Push vs Huge must refuse
// (logged `<feature>_refused`, latch NOT marked); Small + Damage-Bonus legs
// preserve the existing accept shape.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockCombatSummary = null;

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => mockCombatSummary),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 14),
    createSaveListener: vi.fn(() => ({
        promptId: 'test-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
    })),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => mockCombatSummary),
    getTargetFromAttacker: vi.fn(() => ({ name: 'Fire Giant 1' })),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5 })),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/oncePerTurn.js', () => ({
    checkOncePerTurn: vi.fn().mockResolvedValue(null),
    checkOncePerTurnWithSkip: vi.fn().mockResolvedValue(null),
    markOncePerTurn: vi.fn(async () => {}),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

import { applyRiderOption } from './attackRiderHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { markOncePerTurn } from '../../common/oncePerTurn.js';

const campaignName = 'test-campaign';

const chargerAction = {
    name: 'Charge Attack',
    automation: {
        name: 'Charge Attack',
        type: 'attack_rider',
        trigger: 'melee_hit_after_10ft_charge',
        chooseOne: true,
        oncePerTurn: true,
        options: [
            { name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d8' },
            { name: 'Push 10 ft', effect: 'push', value: 10, sizeLimit: 'one_size_larger' },
        ],
    },
};

function makePlayerStats(overrides = {}) {
    return {
        name: 'EvasiveFighter',
        size: 'Medium',
        automation: { passives: [] },
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockCombatSummary = {
        round: 5,
        creatures: [
            { name: 'Fire Giant 1', size: 'Huge', type: 'npc' },
            { name: 'Goblin 1', size: 'Small', type: 'npc' },
        ],
    };
    getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'targetEffects') return [];
        return null;
    });
});

describe('applyRiderOption — Charger size gate (FT-106)', () => {
    it('Push vs Huge target is REFUSED: popup reason + refused log, latch not marked', async () => {
        const result = await applyRiderOption(chargerAction, makePlayerStats(), campaignName, 'Fire Giant 1', ['Push 10 ft']);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('too large for Charger push');
        expect(result.payload.description).toContain('Huge');

        const refusalEntry = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation');
        expect(refusalEntry).toBeDefined();
        expect(refusalEntry.automationType).toBe('charge_attack_refused');
        expect(refusalEntry.description).toContain('too large for Charger push');
        expect(refusalEntry.targetName).toBe('Fire Giant 1');

        // No push ability_use, no latch burn, no targetEffects write.
        const pushLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
        expect(pushLog).toBeUndefined();
        expect(markOncePerTurn).not.toHaveBeenCalled();
        const teWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
        expect(teWrite).toBeUndefined();
    });

    it('Push vs Small target is ACCEPTED and logged (PASS leg B byte-shape)', async () => {
        const result = await applyRiderOption(chargerAction, makePlayerStats(), campaignName, 'Goblin 1', ['Push 10 ft']);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Goblin 1 was pushed 10 feet away.');

        const pushLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
        expect(pushLog).toBeDefined();
        expect(pushLog.description).toBe('EvasiveFighter pushed Goblin 1 10 feet away.');
        expect(markOncePerTurn).toHaveBeenCalled();
        const refusalEntry = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation');
        expect(refusalEntry).toBeUndefined();
    });

    it('Damage Bonus vs Huge target is allowed (no sizeLimit on that option)', async () => {
        const result = await applyRiderOption(chargerAction, makePlayerStats(), campaignName, 'Fire Giant 1', ['Damage Bonus']);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Damage Bonus applied to Fire Giant 1');
        const teWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
        expect(teWrite).toBeDefined();
        expect(teWrite[2]).toEqual(expect.arrayContaining([
            expect.objectContaining({ target: 'Fire Giant 1', effect: 'damage_bonus', damageExpression: '1d8' }),
        ]));
        expect(markOncePerTurn).toHaveBeenCalled();
    });

    it('Trip large_or_smaller vs Huge target is refused too (shared gate revived)', async () => {
        const tripAction = {
            name: 'Cunning Strike',
            automation: {
                type: 'attack_rider',
                oncePerTurn: true,
                options: [{ name: 'Trip', effect: 'prone', sizeLimit: 'large_or_smaller' }],
            },
        };
        const result = await applyRiderOption(tripAction, makePlayerStats(), campaignName, 'Fire Giant 1', ['Trip']);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('too large for Trip');
        expect(markOncePerTurn).not.toHaveBeenCalled();
    });

    it('unknown-size target stays lenient (cache miss allow-through)', async () => {
        const result = await applyRiderOption(chargerAction, makePlayerStats(), campaignName, 'Mystery Target', ['Push 10 ft']);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Mystery Target was pushed 10 feet away.');
        expect(markOncePerTurn).toHaveBeenCalled();
    });
});

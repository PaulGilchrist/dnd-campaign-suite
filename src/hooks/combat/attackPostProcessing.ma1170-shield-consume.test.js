// MA-1170: monster reaction Shield stamp (oneShot:true) is consumed by the ONE
// resolved attack it defends (consumeShieldAcBonus, parry_consumed MA-0341
// lineage). PC Shield-spell buffs (shieldHandler, no oneShot flag) must NEVER
// be stripped here — they expire on their own turn-start clock.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(async () => null),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(async () => ({ finalDamage: 0, newHp: 0 })),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getParryAcBonus: vi.fn(() => 0),
    hasPotentCantrip: vi.fn(() => false),
    applyMinDamageAdjustment: vi.fn((t) => t),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { processAttackAfterResult } from './attackPostProcessing.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const ATTACKER = 'Bandit 1';
const ARCANIST = 'Mind Flayer Arcanist 1';

const monsterShield = { effect: 'shield', acBonus: 5, oneShot: true, source: 'Shield' };
const pcShieldSpell = { effect: 'shield', name: 'Shield', automation: { type: 'buff', effect: 'shield' } };

function makeContext(overrides = {}) {
    return { rollType: 'attack', name: 'Scimitar', playerStats: { automation: { passives: [] } }, ...overrides };
}

function makeState(overrides = {}) {
    return {
        effectiveD20: 13,
        r1: 13,
        r2: 3,
        bonus: 5,
        effectiveD20Roll: 13,
        isCrit: false,
        targetAc: 21,
        effectiveAc: 21,
        homingStrikesUsed: false,
        homingStrikesBonus: 0,
        hit: false,
        isAutoMiss: false,
        ...overrides,
    };
}

function shieldWrites() {
    return setRuntimeValue.mock.calls.filter(c => c[0] === ARCANIST && c[1] === 'activeBuffs');
}

describe('MA-1170 consumeShieldAcBonus via processAttackAfterResult', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('strips the armed oneShot monster Shield stamp when the attack against the defended monster resolves', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === ARCANIST && prop === 'activeBuffs') return [{ effect: 'haste' }, monsterShield];
            return null;
        });

        await processAttackAfterResult({ hit: false, isAutoMiss: false, targetName: ARCANIST, characterName: ATTACKER, campaignName: CAMPAIGN, context: makeContext(), combatSummary: null, characters: [], logEntry: vi.fn(), setPopupHtml: vi.fn(), state: makeState({ hit: false }) });

        const writes = shieldWrites();
        expect(writes.length).toBe(1);
        expect(writes[0][2]).toEqual([{ effect: 'haste' }]);
        const consume = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'shield_consumed');
        expect(consume).toBeDefined();
        expect(consume.description).toMatch(/Shield \+5 AC was consumed/);
    });

    it('consumes on a HIT too (the shield defended exactly one attack)', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === ARCANIST && prop === 'activeBuffs') return [monsterShield];
            return null;
        });

        await processAttackAfterResult({ hit: true, isAutoMiss: false, targetName: ARCANIST, characterName: ATTACKER, campaignName: CAMPAIGN, context: makeContext(), combatSummary: null, characters: [], logEntry: vi.fn(), setPopupHtml: vi.fn(), state: makeState({ hit: true, effectiveD20: 16 }) });

        const writes = shieldWrites();
        expect(writes.length).toBe(1);
        expect(writes[0][2]).toEqual([]);
    });

    it('NEVER strips the persistent PC Shield-spell buff (no oneShot flag)', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === ARCANIST && prop === 'activeBuffs') return [pcShieldSpell];
            return null;
        });

        await processAttackAfterResult({ hit: true, isAutoMiss: false, targetName: ARCANIST, characterName: ATTACKER, campaignName: CAMPAIGN, context: makeContext(), combatSummary: null, characters: [], logEntry: vi.fn(), setPopupHtml: vi.fn(), state: makeState() });

        expect(shieldWrites()).toHaveLength(0);
        const consume = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'shield_consumed');
        expect(consume).toBeUndefined();
    });

    it('writes nothing when the defended target holds no shield buff at all', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === ARCANIST && prop === 'activeBuffs') return [{ effect: 'bless' }];
            return null;
        });

        await processAttackAfterResult({ hit: true, isAutoMiss: false, targetName: ARCANIST, characterName: ATTACKER, campaignName: CAMPAIGN, context: makeContext(), combatSummary: null, characters: [], logEntry: vi.fn(), setPopupHtml: vi.fn(), state: makeState() });

        expect(shieldWrites()).toHaveLength(0);
    });
});

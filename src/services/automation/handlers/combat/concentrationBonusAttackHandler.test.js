// @maintained-by-ai
// CLA-356 regression: Telekinetic Master (Psi Warrior lv18) concentration bonus attack.
// The row was popup-only (no attack resolved). It must now: gate on LIVE cs concentration
// (refuse + log, spend nothing when absent), latch once per turn, arm the current target,
// roll a real weapon attack through applyDamageToTarget, log attack/damage/hp_change +
// ability_use, stamp lastAttack, and refuse re-clicks the same round.
// Seam map: concentration STATE canon (establish/clear) lives in spellPreparationService +
// useInitiativeEffects.concentrationClearing.test.js — this lane only READS live cs
// concentration as a gate and owns the once-per-turn latch (LATCH_KEY) + attack seam.
// Row SHAPE construction: automationInfoBuilder/attack.test.js; slot surfacing:
// spellCalc2024-telekinetic-master.test.js; router categorization:
// automationCollector.types.test.js. applyDamage/hp_change: delegated pin only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/utils.js', () => ({
    DEBUG_FORCE_CRIT: false,
}));

import { handle } from './concentrationBonusAttackHandler.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { rollD20, rollExpression, rollExpressionDoubled } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';

function makeAction(overrides = {}) {
    return {
        name: 'Telekinetic Master',
        automation: {
            type: 'concentration_bonus_attack',
            trigger: 'each_turn',
            action: 'bonus_action',
            weaponAttack: true,
            concentrationSpell: 'Telekinesis',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'EvasiveFighter',
        attacks: [{ name: 'Scimitar', hitBonus: 9, damage: '1d6+3', damageType: 'Slashing', attackType: 'melee' }],
        ...overrides,
    };
}

function csWithConcentration(spell, round = 1) {
    return {
        round,
        creatures: [
            { name: 'EvasiveFighter', type: 'player', targetName: 'Thug 1', concentration: spell ? { spell, dc: 17 } : null },
            { name: 'Thug 1', type: 'monster', ac: 11, currentHp: 32, maxHp: 32 },
        ],
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    rollExpressionDoubled.mockReturnValue({ total: 12, rolls: [6, 6, 3] });
    rollExpression.mockReturnValue({ total: 8, rolls: [5, 3] });
});

describe('concentrationBonusAttackHandler — CLA-356', () => {
    it('resolves a real weapon attack when concentrating on Telekinesis', async () => {
        getCombatContext.mockResolvedValue(csWithConcentration('Telekinesis'));
        getTargetFromAttacker.mockReturnValue({ name: 'Thug 1', ac: 11, currentHp: 32, maxHp: 32 });
        rollD20.mockReturnValue(15);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 8 });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(rollD20).toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Thug 1', 8, ['Slashing'], { campaignName, characters: expect.any(Array), ignoreResistance: false, attackerName: 'EvasiveFighter' });
        // once-per-turn latch stamped on the player.
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_Telekinetic_Master_attack_usedRound', { round: 1, activeCreature: 'EvasiveFighter' }, campaignName);
        // ability_use log records the applied attack bonus result.
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'EvasiveFighter',
            abilityName: 'Telekinetic Master',
        }));
        // lastAttack stamped BEFORE applyDamage so the rider merge keeps the attack seam.
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', expect.objectContaining({
            attackerName: 'EvasiveFighter',
            targetName: 'Thug 1',
            d20: 15,
            total: 24,
            hit: true,
            isCrit: false,
            targetAc: 11,
            rollType: 'attack',
        }), campaignName);
        expect(result.payload.description).toMatch(/HIT/);
        expect(result.payload.description).toMatch(/15\+9=24 vs AC 11/);
    });

    it('rolls a crit with doubled damage dice on a natural 20', async () => {
        getCombatContext.mockResolvedValue(csWithConcentration('Telekinesis'));
        getTargetFromAttacker.mockReturnValue({ name: 'Thug 1', ac: 11, currentHp: 32, maxHp: 32 });
        rollD20.mockReturnValue(20);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 12 });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(rollExpressionDoubled).toHaveBeenCalledWith('1d6+3');
        expect(rollExpression).not.toHaveBeenCalled();
        // raw doubled total routes through applyDamageToTarget.
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Thug 1', 12, ['Slashing'], { campaignName, characters: expect.any(Array), ignoreResistance: false, attackerName: 'EvasiveFighter' });
        expect(result.payload.description).toMatch(/CRITICAL HIT/);
        expect(result.payload.description).toMatch(/20\+9=29 vs AC 11/);
    });

    it('refuses (spends nothing, no attack roll) when not concentrating', async () => {
        getCombatContext.mockResolvedValue(csWithConcentration(null));

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(rollD20).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            automationType: 'concentration_bonus_attack_refused',
        }));
        expect(result.payload.description).toMatch(/not concentrating/i);
    });

    it('refuses a second activation in the same round (once-per-turn latch)', async () => {
        getCombatContext.mockResolvedValue(csWithConcentration('Telekinesis'));
        getTargetFromAttacker.mockReturnValue({ name: 'Thug 1', ac: 11, currentHp: 32, maxHp: 32 });
        rollD20.mockReturnValue(15);
        getRuntimeValue.mockImplementation((name, key) => (key === '_Telekinetic_Master_attack_usedRound' ? { round: 1, activeCreature: 'EvasiveFighter' } : null));

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(rollD20).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            automationType: 'concentration_bonus_attack_refused',
        }));
        expect(result.payload.description).toMatch(/already made/i);
    });

    it('re-arms on a new round — a prior-round latch does not stick', async () => {
        getCombatContext.mockResolvedValue(csWithConcentration('Telekinesis', 2));
        getTargetFromAttacker.mockReturnValue({ name: 'Thug 1', ac: 11, currentHp: 32, maxHp: 32 });
        rollD20.mockReturnValue(15);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 8 });
        // Latch from last round survives; only round >= current blocks.
        getRuntimeValue.mockImplementation((name, key) => (key === '_Telekinetic_Master_attack_usedRound' ? { round: 1, activeCreature: 'EvasiveFighter' } : null));

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(rollD20).toHaveBeenCalled();
        expect(result.payload.description).toMatch(/HIT/);
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_Telekinetic_Master_attack_usedRound', { round: 2, activeCreature: 'EvasiveFighter' }, campaignName);
    });

    it('refuses with no armed target and stamps no latch', async () => {
        getCombatContext.mockResolvedValue(csWithConcentration('Telekinesis'));
        getTargetFromAttacker.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(rollD20).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.payload.description).toMatch(/No target selected/i);
    });

    it('logs a miss without applying damage', async () => {
        getCombatContext.mockResolvedValue(csWithConcentration('Telekinesis'));
        getTargetFromAttacker.mockReturnValue({ name: 'Thug 1', ac: 18, currentHp: 32, maxHp: 32 });
        rollD20.mockReturnValue(5); // 5+9=14 < 18

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_Telekinetic_Master_attack_usedRound', { round: 1, activeCreature: 'EvasiveFighter' }, campaignName);
        expect(result.payload.description).toMatch(/MISS/);
    });

    it('returns a no-combat popup when combat context is missing', async () => {
        getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(rollD20).not.toHaveBeenCalled();
        expect(result.payload.description).toMatch(/No combat context/);
    });
});

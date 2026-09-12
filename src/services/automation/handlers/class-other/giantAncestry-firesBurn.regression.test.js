// Regression test for CLA-141: Fire's Burn – Goliath.
//
// The original verification stalled because the character's attack did not
// populate `campaign.lastAttack` with a valid `targetName` + `rollType:'attack'`,
// so the Fire's Burn handler rejected it ("requires a target"). These tests lock
// in the full pipeline contract observed end-to-end in the running app:
//   info-builder -> router categorization -> registry handler,
// using the REAL findLastAttack parser (not mocked) against the exact
// lastAttack record shapes that `processAttackAfterResult` writes.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn((_expr) => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, newHp: 55, oldHp: 60, damageReduced: false })),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => ({ actualHeal: 0, oldHp: 60, newHp: 60 })),
}));

import { handleFiresBurnDirect } from './giantAncestryHandler.js';
import { getRuntimeUsesKey } from './giantAncestryOptions.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { elementalHandlers } from '../../../combat/automation/automationInfoBuilder/elemental-handlers.js';
import { routeAutomation } from '../../../combat/automation/automationRouter.js';

const PLAYER = 'GoliathFireGiant';
const TARGET = 'Ogre 1';

function makePlayerStats() {
    return { name: PLAYER, proficiency: 3, abilities: [{ name: 'Constitution', bonus: 5 }] };
}

function makeDirectAction() {
    return {
        name: "Fire's Burn",
        automation: {
            type: 'fire_burn',
            damage: '1d10',
            damageType: 'Fire',
            trigger: 'hit',
            uses: 'proficiency_bonus',
            recharge: 'long_rest',
            casting_time: '1 action',
        },
    };
}

// Seed getRuntimeValue to return the provided campaign lastAttack + a uses count.
function seedRuntime({ lastAttack, uses }) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === PLAYER && key === 'firesBurnUses') return uses;
        if (name === 'campaign' && key === 'lastAttack') return lastAttack;
        return null;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('CLA-141 Fire Burn regression (real findLastAttack parser)', () => {
    it('uses runtime key firesBurnUses for Fire Giant ancestry', () => {
        expect(getRuntimeUsesKey("Fire's Burn")).toBe('firesBurnUses');
    });

    it('routes fire_burn (1 action) into the actions list, not passives/reactions', () => {
        const feature = {
            name: "Fire's Burn",
            automation: { type: 'fire_burn', damage: '1d10', damageType: 'Fire', trigger: 'hit', uses: 'proficiency_bonus', recharge: 'long_rest', casting_time: '1 action' },
        };
        const info = elementalHandlers.fire_burn(feature, makePlayerStats());
        expect(info).toMatchObject({ type: 'fire_burn', damage: '1d10', damageType: 'Fire', casting_time: '1 action' });

        const result = { actions: [], bonusActions: [], reactions: [], passives: [], specialActions: [] };
        routeAutomation(info, feature.automation, result);
        expect(result.actions).toHaveLength(1);
        expect(result.passives).toHaveLength(0);
        expect(result.reactions).toHaveLength(0);
    });

    it('applies 1d10 Fire damage, consumes a use, and logs after a real hit', async () => {
        seedRuntime({
            uses: 3,
            lastAttack: {
                attackerName: PLAYER,
                targetName: TARGET,
                d20: 9,
                bonus: 8,
                total: 17,
                targetAc: 11,
                hit: true,
                rollType: 'attack',
                damageType: 'Slashing',
                primaryDamage: 8,
            },
        });

        const result = await handleFiresBurnDirect(makeDirectAction(), makePlayerStats(), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('damage');
        expect(result.payload.damageType).toBe('Fire');
        expect(result.payload.formula).toBe('1d10');
        expect(result.payload.targetName).toBe(TARGET);
        expect(applyDamageToTarget).toHaveBeenCalledWith(null, TARGET, 5, ['Fire'], 'test-campaign', [], { ignoreResistance: false, attackerName: PLAYER });
        expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'firesBurnUses', 2, 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'roll',
            rollType: 'damage',
            characterName: PLAYER,
            targetName: TARGET,
            damageType: 'Fire',
            total: 5,
        }));
    });

    it('rejects a stale skill-roll lastAttack without consuming a use (original blocker)', async () => {
        seedRuntime({
            uses: 3,
            lastAttack: {
                attackerName: PLAYER,
                targetName: null,
                checkName: 'Sleight of Hand',
                rollType: 'skill',
                total: 0,
            },
        });

        const result = await handleFiresBurnDirect(makeDirectAction(), makePlayerStats(), 'test-campaign');

        expect(result.payload.type).toBe('automation_info');
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('rejects an attack lastAttack missing a target without consuming a use', async () => {
        seedRuntime({
            uses: 3,
            lastAttack: {
                attackerName: PLAYER,
                targetName: null,
                rollType: 'attack',
                hit: true,
            },
        });

        const result = await handleFiresBurnDirect(makeDirectAction(), makePlayerStats(), 'test-campaign');

        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('requires a target');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

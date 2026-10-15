// @maintained-by-ai
// Stone's Endurance steady-state lane (family recipe, hillsTumble main 14→10
// precedent): the dispatch and direct handlers ride the SAME shared utils
// (resolveAncestryUses → ancestryNoUsesPopup → stonesEnduranceDamageGate →
// heal body), so the former test-for-test mirror is trimmed. Dispatch owns the
// full gate-refusal table with zero-side-effect guards plus the option→popup
// flow (its automationType flows from option.type — 'damage_reduction'); the
// direct lane is a thin wiring twin keeping ONLY its own composition (hardcoded
// 'stones_endurance' automationType, full-string popup/log pins with honest
// fixture numbers) and one shared-gate wiring refusal. No-uses stays a
// fixture-shape pin in dispatch only (0 uses → refusal, zero writes).
// CLA-335 round-latch behaviour (stamp, re-arm, refire refusal, cap texts) is
// owned by giantAncestry-stonesEndurance.refire.test.js — deliberately NOT
// re-pinned here (makeUsesMock never sets _Stones_Endurance_usedRound).
import { vi } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn((_expr) => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((_expr) => 5),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, newHp: 15, oldHp: 20, damageReduced: false })),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => ({ actualHeal: 12, oldHp: 10, newHp: 22 })),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(async () => ({
        attackEvent: { rollType: 'attack', attackerName: 'TestHero' },
        attackerName: 'TestHero',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['slashing'],
    })),
}));

beforeEach(() => { vi.resetAllMocks(); });
import { describe, it, expect } from 'vitest';
import {
    handleStonesEndurance,
    handleStonesEnduranceDirect,
} from './giantAncestryHandler.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { makeAction, makePlayerStats } from './giantAncestry.test.setup.js';

function makeUsesMock(usesKey, value) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === usesKey) return value;
        return null;
    });
}

// Zero-side-effect guard: gate refusals must never spend a use (or stamp the
// round latch) — the shared helpers refuse before any write.
function expectNoWrites() {
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(applyHealingToTarget).not.toHaveBeenCalled();
}

describe('giantAncestry selection & dispatch', () => {
    describe('handleStonesEndurance', () => {
        const option = { name: "Stone's Endurance", type: 'damage_reduction', reductionExpression: '1d10 + CON modifier' };

        it('heals when giant was target and took damage: exact-key spend, logs, option type flows to popup', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', attackerName: 'Orc' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 15,
            });
            // Honest fixture: rawHeal = min(roll 5 + CON 2, damage 15) = 7
            applyHealingToTarget.mockReturnValue({ actualHeal: 7, oldHp: 217, newHp: 224 });

            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            // Dispatch's own composition: automationType flows from option.type.
            expect(result.payload.automationType).toBe('damage_reduction');
            expect(result.payload.description).toContain("Stone's Endurance");
            expect(result.payload.description).toContain('Healed');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stonesEnduranceUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: "Stone's Endurance",
            }));
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'healing',
                characterName: 'TestHero',
            }));
        });

        it('returns popup when player was not the target', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
                totalDamage: 10,
            });

            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('you were the target');
            expectNoWrites();
        });

        it('returns popup when no damage was dealt', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 0,
            });

            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('took damage');
            expectNoWrites();
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('stonesEnduranceUses', 0);
            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
            expectNoWrites();
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('recent attack');
            expectNoWrites();
        });
    });

    // Direct lane is a thin wiring twin over the same shared gate/heal helpers
    // (giantAncestryUtils.js) — keeps only its own composition (hardcoded
    // 'stones_endurance' automationType + exact popup/log strings) and one
    // shared-gate wiring refusal. The round-latch stamp/refire refusal and
    // cap-text composition belong to giantAncestry-stonesEndurance.refire.test.js.
    describe('handleStonesEnduranceDirect', () => {
        const directAction = {
            name: "Stone's Endurance",
            automation: {
                type: 'stones_endurance',
                reductionExpression: '1d12 + CON modifier',
                trigger: 'damage_received',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 reaction',
            },
        };

        it('heals with own hardcoded stones_endurance automationType: full-string composition pins', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', attackerName: 'Orc' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 15,
            });
            // Honest fixture: rawHeal = min(roll 5 + CON 2, damage 15) = 7
            applyHealingToTarget.mockReturnValue({ actualHeal: 7, oldHp: 217, newHp: 224 });

            const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe("Stone's Endurance");
            expect(result.payload.automationType).toBe('stones_endurance');
            expect(result.payload.description).toBe("Stone's Endurance: Rolled <strong>5</strong> + 2 CON = <strong>7</strong>. Healed <strong>7</strong> HP.");
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stonesEnduranceUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: "Stone's Endurance",
                description: "TestHero used Stone's Endurance to heal 7 HP (rolled 5 + 2 CON modifier = 7).",
            }));
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'healing',
                characterName: 'TestHero',
                amount: 7,
                source: "Stone's Endurance",
            }));
        });

        it('wires the shared stonesEnduranceDamageGate: refuses wrong-target with zero spend', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
                totalDamage: 10,
            });

            const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('you were the target');
            expectNoWrites();
        });
    });
});

// MA-1645: Vampire Nightbringer "Bite" attack-lane drain + regain consumers —
// the fix that made "The target's Hit Point maximum decreases by an amount
// equal to the Necrotic damage taken, and the vampire regains Hit Points
// equal to that amount" LAND on the dual-damage attack row. Locks:
// (1) equal_to:"secondary" drain consumes secondaryFinalDamage (Necrotic),
//     NEVER applyResult.finalDamage (PRIMARY Piercing — the honesty flag in
//     the bug file: the plain byte-twin drains the WRONG pool);
// (2) hit_attacker_recover heals the ATTACKER by the SAME RAW amount via the
//     canonical applyHealingToTarget choke point (real service, fake cs —
//     MA-1639 applySaveAttackerRecoverLeg mirror) with the recover log;
// (3) accumulation: the te ledger {baseMax,reduced,max} sums across hits and
//     the regain re-reads the attacker's raised currentHp;
// (4) byte-inertia: the Specter equal_to:"damage" twin keeps consuming
//     finalDamage with NO attacker heal, and clauseless rows are zero-state.
// MA-1489/MA-1451 byte-twin mocking.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn((formula) => (formula === '3d6' ? { rolls: [3, 3, 3], total: 9 } : { rolls: [2], total: 2 })),
    rollExpressionDoubled: vi.fn(),
    parseConstant: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
    setRuntimeObject: vi.fn(() => Promise.resolve()),
    getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../../services/npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

vi.mock('../../../services/combat/conditions/targetEffectDefinitions.js', async (importActual) => ({
    ...(await importActual()),
    registerTargetEffect: vi.fn(),
}));

vi.mock('../../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { registerTargetEffect } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import storage from '../../../services/ui/storage.js';
import { createPlainDamageHandler } from './handlePlainDamage.js';
import { buildHitConditionClause } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const NIGHTBRINGER_BITE = monsters.find(m => m.index === 'vampire-nightbringer').actions[1];
const SPECTER_DRAIN = monsters.find(m => m.index === 'specter').actions[0];

const ATTACKER = 'Vampire Nightbringer 1';
const VICTIM = 'Bandit 1';

describe('MA-1645 Nightbringer Bite attack-lane drain + regain', () => {
    const deps = {
        characterName: ATTACKER,
        campaignName: 'test-campaign',
        characters: [{ name: VICTIM, computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    function freshCs() {
        return {
            round: 1,
            creatures: [
                { name: ATTACKER, type: 'npc', size: 'Medium', ac: 16, currentHp: 100, maxHp: 142 },
                { name: VICTIM, type: 'npc', size: 'Medium', ac: 12, currentHp: 999, maxHp: 999, resistances: [] },
            ],
        };
    }

    async function resolveHit({ cs = freshCs(), primary = 6, secondary = 9, clause = buildHitConditionClause(NIGHTBRINGER_BITE), includeSecondary = true, primaryFinal = null } = {}) {
        // Secondary leg rolls through resolveSecondaryRoll → rollExpression(secondaryFormula); drive its total per-test.
        rollExpression.mockImplementation((formula) => (formula === '3d6' ? { rolls: [secondary], total: secondary } : { rolls: [2], total: 2 }));
        applyDamageToTarget.mockImplementation(async (_cs, _name, dmg) => {
            const finalDamage = primaryFinal != null && dmg === primary ? primaryFinal : dmg;
            return { finalDamage, newHp: 999 - finalDamage, damageReduced: false };
        });
        await createPlainDamageHandler(deps)({
            name: 'Bite', formula: '1d6 + 4', total: 6, rolls: [2], modifier: 4,
            adjustedTotal: primary, combatSummary: cs,
            context: {
                targetName: VICTIM, damageType: 'Piercing', attackerName: ATTACKER, hitClause: clause,
                ...(includeSecondary ? { autoDamageSecondaryFormula: '3d6', autoDamageSecondaryName: 'Bite', autoDamageSecondaryDamageType: 'Necrotic' } : {}),
            },
        });
        return {
            victim: cs.creatures.find(c => c.name === VICTIM),
            attacker: cs.creatures.find(c => c.name === ATTACKER),
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('DATA lock: the row authors both riders scoped to the NECROTIC secondary pool', () => {
        expect(NIGHTBRINGER_BITE.hit_hp_max_reduce).toEqual({ equal_to: 'secondary' });
        expect(NIGHTBRINGER_BITE.hit_attacker_recover).toEqual({ equal_to: 'secondary' });
        expect(buildHitConditionClause(NIGHTBRINGER_BITE)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Bite',
            targetEffect: null,
            hpMaxReduce: { equalTo: 'secondary' },
            attackerRecover: { equalTo: 'secondary' },
        });
    });

    it('HIT: victim maxHp drops by secondaryFinalDamage (NOT finalDamage), te ledger + drain log + attacker regain via canonical heal', async () => {
        const { victim, attacker } = await resolveHit({ primary: 6, secondary: 9 });

        expect(victim.maxHp).toBe(990);
        expect(victim.currentHp).toBe(990);
        expect(attacker.currentHp).toBe(109);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({ round: 1 }), 'test-campaign');
        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            VICTIM,
            'hp_max_reduce',
            ATTACKER,
            { baseMax: 999, reduced: 9, max: 990, duration: 'until_long_rest' },
        );
        const entries = deps.logEntry.mock.calls.map(c => c[0]);
        const grant = entries.find(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Max HP Reduced');
        expect(grant.reason).toBe('Bite — max HP 999 → 990 (−9, equal to damage taken)');
        const recover = entries.find(e => e.type === 'automation' && e.automationType === 'hit_attacker_recover');
        expect(recover.characterName).toBe(ATTACKER);
        expect(recover.description).toContain('regains 9 Hit Points');
        expect(recover.description).toContain('100 → 109');
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('ACCUMULATE: standing ledger + second hit — max drops another 16, attacker climbs 109 → 125', async () => {
        const standing = { target: VICTIM, effect: 'hp_max_reduce', baseMax: 999, reduced: 9, max: 990, source: ATTACKER, duration: 'until_long_rest' };
        getRuntimeValue.mockImplementation((name, key) => (key === 'targetEffects' ? [standing] : null));
        const cs = freshCs();
        cs.creatures.find(c => c.name === ATTACKER).currentHp = 109;
        cs.creatures.find(c => c.name === VICTIM).currentHp = 984;
        cs.creatures.find(c => c.name === VICTIM).maxHp = 990;

        const { victim, attacker } = await resolveHit({ cs, primary: 5, secondary: 16 });

        expect(victim.maxHp).toBe(974);
        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            VICTIM,
            'hp_max_reduce',
            ATTACKER,
            { baseMax: 999, reduced: 25, max: 974, duration: 'until_long_rest' },
        );
        expect(attacker.currentHp).toBe(125);
        const recover = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.automationType === 'hit_attacker_recover');
        expect(recover.description).toContain('regains 16 Hit Points');
        expect(recover.description).toContain('109 → 125');
    });

    it('NECROTIC-EQUAL HONESTY: drain amount never reads applyResult.finalDamage on secondary-scoped rows', async () => {
        // Primary reduced (resistance) to 2 while NECROTIC pays full 9 — the drain MUST follow the 9.
        const { victim } = await resolveHit({ primary: 6, secondary: 9, primaryFinal: 2 });
        expect(victim.maxHp).toBe(990);
    });

    it('BYTE-INERT TWIN: Specter equal_to:"damage" drains finalDamage, regains NOTHING (no key)', async () => {
        const { victim, attacker } = await resolveHit({ clause: buildHitConditionClause(SPECTER_DRAIN), includeSecondary: false });

        expect(victim.maxHp).toBe(993);
        expect(attacker.currentHp).toBe(100);
        const entries = deps.logEntry.mock.calls.map(c => c[0]);
        expect(entries.some(e => e.automationType === 'hit_attacker_recover')).toBe(false);
    });

    it('ZERO-STATE: clauseless rows arm neither rider', async () => {
        const banditRow = monsters.find(m => m.name === 'Bandit').actions.find(a => a.attack_bonus != null);
        expect(buildHitConditionClause(banditRow)).toBeNull();
        const { victim, attacker } = await resolveHit({ clause: null });

        expect(victim.maxHp).toBe(999);
        expect(attacker.currentHp).toBe(100);
        expect(registerTargetEffect).not.toHaveBeenCalled();
    });

    it('SECONDARY ZERO: necrotic pool reduced to 0 pays zero drain + zero regain, both logged honestly', async () => {
        const { victim, attacker } = await resolveHit({ secondary: 0 });

        expect(victim.maxHp).toBe(999);
        expect(attacker.currentHp).toBe(100);
        const entries = deps.logEntry.mock.calls.map(c => c[0]);
        expect(entries.some(e => e.automationType === 'hp_max_reduce' && /reduced by 0/.test(e.description))).toBe(true);
        expect(entries.some(e => e.automationType === 'hit_attacker_recover' && /regains 0 Hit Points/.test(e.description))).toBe(true);
    });
});

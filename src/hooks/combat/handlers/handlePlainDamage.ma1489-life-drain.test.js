// MA-1489: Specter "Life Drain" HP-max-drain rider — the fix that made the
// HIT clause "its Hit Point maximum decreases by an amount equal to the damage
// taken" LAND (was FAIL(a) zero-state, §947: hpMaxReduction consumers
// reset-only, no te, no parser, hit_target_effect seam inert). MA-1451
// byte-twin mocking. Locks: (1) specter.actions[0] authors the structured
// hit_hp_max_reduce key, existing bytes byte-pinned; (2) parseHitHpMaxReduce
// is structured-key-only (byte-inert null elsewhere); (3) on every resolved
// hit the consumer reduces cs maxHp by exactly the damage TAKEN, clamps
// currentHp, registers the hp_max_reduce te ledger {baseMax, reduced, max},
// logs the old→new grant — NO addExpiration clock; (4) accumulation across
// hits; (5) PC victims stamp the hitPoints/currentHitPoints/hpMaxReduction
// shape greaterRestorationHandler consumes; (6) max reaching 0 clamps lethal
// via the canonical applyDamageToTarget choke point; (7) zero-damage hit and
// unauthored rows are zero-state; (8) LONG_REST_TARGET_EFFECT_CLEAR_KEYS
// pins 'hp_max_reduce' and the LR restore runs before the clear.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn((_formula) => ({ rolls: [3, 4], total: 7 })),
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

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { registerTargetEffect, getEffectDefinition } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import storage from '../../../services/ui/storage.js';
import { createPlainDamageHandler } from './handlePlainDamage.js';
import { buildHitConditionClause, parseHitHpMaxReduce } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const SPECTER = monsters.find(m => m.index === 'specter');
const LIFE_DRAIN = SPECTER.actions[0];

describe('MA-1489 Specter Life Drain hp_max_reduce producer', () => {
    const deps = {
        characterName: 'Specter 1',
        campaignName: 'test-campaign',
        characters: [{ name: 'Bandit 1', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    function freshCs() {
        return {
            round: 1,
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium or Small', ac: 12, currentHp: 999, maxHp: 11 }],
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 7, newHp: 992, damageReduced: false });
    });

    async function resolveHit({ cs = freshCs(), targetName = 'Bandit 1', finalDamage = 7 } = {}) {
        applyDamageToTarget.mockResolvedValue({ finalDamage, newHp: 999 - finalDamage, damageReduced: false });
        await createPlainDamageHandler(deps)({
            name: 'Life Drain', formula: '2d6', total: 7, rolls: [3, 4], modifier: 0,
            adjustedTotal: 7, combatSummary: cs,
            context: { targetName, damageType: 'Necrotic', attackerName: 'Specter 1', hitClause: buildHitConditionClause(LIFE_DRAIN) },
        });
        return cs.creatures.find(c => c.name === targetName);
    }

    it('DATA: specter.actions[0] authors the structured HP-max rider; existing bytes byte-pinned', () => {
        expect(LIFE_DRAIN.hit_hp_max_reduce).toEqual({ equal_to: 'damage' });
        expect(LIFE_DRAIN.attack_bonus).toBe(4);
        expect(LIFE_DRAIN.reach).toBe('5 ft.');
        expect(LIFE_DRAIN.damage_dice_primary).toBe('2d6');
        expect(LIFE_DRAIN.damage_type_primary).toBe('Necrotic');
        expect(LIFE_DRAIN.description).toBe('Melee Attack Roll: +4, reach 5 ft. Hit: 7 (2d6) Necrotic damage. If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.');
    });

    it('PARSER: buildHitConditionClause carries hpMaxReduce; every other row stays byte-inert', () => {
        expect(buildHitConditionClause(LIFE_DRAIN)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Life Drain',
            targetEffect: null,
            hpMaxReduce: { equalTo: 'damage' },
        });
        expect(parseHitHpMaxReduce({})).toBeNull();
        expect(parseHitHpMaxReduce({ hit_hp_max_reduce: {} })).toBeNull();
        expect(parseHitHpMaxReduce({ hit_hp_max_reduce: { equal_to: 'healing' } })).toBeNull();
        expect(parseHitHpMaxReduce({ hit_hp_max_reduce: 'damage' })).toBeNull();
        const banditRow = monsters.find(m => m.name === 'Bandit').actions.find(a => a.attack_bonus != null);
        expect(parseHitHpMaxReduce(banditRow)).toBeNull();
        expect(buildHitConditionClause(banditRow)).toBeNull();
    });

    it('REGISTRY: hp_max_reduce registered Saves & Checks debuff, source field only (ledger rides extraProps)', () => {
        const def = getEffectDefinition('hp_max_reduce');
        expect(def).toBeTruthy();
        expect(def.label).toBe('HP Max Reduced');
        expect(def.cls).toBe('effect-debuff');
        expect(def.group).toBe('Saves & Checks');
        expect(def.fields).toEqual(['source']);
        expect(def.description).toMatch(/Hit Point maximum/i);
        expect(def.description).toMatch(/long rest/i);
    });

    it('HIT: cs maxHp drops by exactly the damage taken, currentHp clamps, te ledger + old→new grant log land, NO clock', async () => {
        const bandit = await resolveHit();

        expect(bandit.maxHp).toBe(4);
        expect(bandit.currentHp).toBe(4);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({ round: 1 }), 'test-campaign');
        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Bandit 1',
            'hp_max_reduce',
            'Specter 1',
            { baseMax: 11, reduced: 7, max: 4, duration: 'until_long_rest' },
        );
        const grant = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Max HP Reduced');
        expect(grant.reason).toBe('Life Drain — max HP 11 → 4 (−7, equal to damage taken)');
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('CLAMP VARIANTS: cs entries carrying the *HitPoints variants get them stamped too (§296/§298)', async () => {
        const cs = {
            round: 1,
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium or Small', ac: 12, currentHp: 999, maxHp: 11, currentHitPoints: 999, maxHitPoints: 11 }],
        };
        const bandit = await resolveHit({ cs });

        expect(bandit.maxHitPoints).toBe(4);
        expect(bandit.currentHitPoints).toBe(4);
    });

    it('ACCUMULATE: a standing ledger accumulates without re-reading the base (prevMax from te, reduced sums)', async () => {
        const standing = { target: 'Bandit 1', effect: 'hp_max_reduce', baseMax: 11, reduced: 3, max: 8, source: 'Specter 1', duration: 'until_long_rest' };
        getRuntimeValue.mockImplementation((name, key) => (key === 'targetEffects' ? [standing] : null));

        const bandit = await resolveHit({ finalDamage: 5 });

        expect(bandit.maxHp).toBe(3);
        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Bandit 1',
            'hp_max_reduce',
            'Specter 1',
            { baseMax: 11, reduced: 8, max: 3, duration: 'until_long_rest' },
        );
        const grant = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Max HP Reduced');
        expect(grant.reason).toBe('Life Drain — max HP 8 → 3 (−5, equal to damage taken)');
    });

    it('PC VICTIM: stamps the hitPoints/currentHitPoints/hpMaxReduction shape greaterRestorationHandler consumes', async () => {
        const cs = { round: 1, creatures: [{ name: 'AasimarTest', type: 'player', size: 'Medium', ac: 18, currentHp: 25, maxHp: 27 }] };
        getRuntimeValue.mockImplementation((name, key) => (key === 'hitPoints' ? 27 : key === 'currentHitPoints' ? 25 : null));

        await createPlainDamageHandler(deps)({
            name: 'Life Drain', formula: '2d6', total: 7, rolls: [3, 4], modifier: 0,
            adjustedTotal: 7, combatSummary: cs,
            context: { targetName: 'AasimarTest', damageType: 'Necrotic', attackerName: 'Specter 1', hitClause: buildHitConditionClause(LIFE_DRAIN) },
        });

        const writes = setRuntimeValue.mock.calls.filter(c => c[0] === 'AasimarTest').map(c => [c[1], c[2]]);
        expect(writes).toContainEqual(['hitPoints', 20]);
        expect(writes).toContainEqual(['currentHitPoints', 20]);
        expect(writes).toContainEqual(['hpMaxReduction', 7]);
        expect(storage.set).not.toHaveBeenCalled();
    });

    it('DEATH CLAMP: max reaching 0 rides the canonical applyDamageToTarget choke point + logs hp_max_reduce_lethal', async () => {
        const standing = { target: 'Bandit 1', effect: 'hp_max_reduce', baseMax: 11, reduced: 9, max: 2, source: 'Specter 1', duration: 'until_long_rest' };
        getRuntimeValue.mockImplementation((name, key) => (key === 'targetEffects' ? [standing] : null));
        const cs = freshCs();
        cs.creatures[0].currentHp = 5;

        await resolveHit({ cs, finalDamage: 2 });

        const lethalCall = applyDamageToTarget.mock.calls.find(c => c[2] === 5);
        expect(lethalCall).toBeTruthy();
        expect(lethalCall[3]).toEqual(['Necrotic']);
        expect(lethalCall[4]).toMatchObject({ campaignName: 'test-campaign', ignoreResistance: true, attackerName: 'Specter 1' });
        const lethalLog = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.automationType === 'hp_max_reduce_lethal');
        expect(lethalLog.description).toContain('falls');
        expect(cs.creatures[0].maxHp).toBe(0);
    });

    it('ZERO DAMAGE: a 0-finalDamage hit reduces nothing (equal-to-damage is 0) but logs — no writes', async () => {
        await resolveHit({ finalDamage: 0 });

        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        const zeroLog = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.automationType === 'hp_max_reduce');
        expect(zeroLog.description).toContain('reduced by 0');
    });

    it('BYTE-INERT PIPELINE: a row without the rider registers nothing, writes nothing, logs no drain', async () => {
        const clause = buildHitConditionClause({ name: 'Scimitar', attack_bonus: 5, damage_dice_primary: '1d6 + 1' });
        expect(clause).toBeNull();

        await createPlainDamageHandler(deps)({
            name: 'Scimitar', formula: '1d6 + 1', total: 6, rolls: [5], modifier: 1,
            adjustedTotal: 6, combatSummary: freshCs(),
            context: { targetName: 'Bandit 1', damageType: 'Slashing', attackerName: 'Specter 1' },
        });

        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(deps.logEntry.mock.calls.map(c => c[0]).some(e => (e.automationType || '').startsWith('hp_max_reduce') || e.condition === 'Max HP Reduced')).toBe(false);
    });

    it('LR CLEAR KEYS: LONG_REST_TARGET_EFFECT_CLEAR_KEYS pins hp_max_reduce and the LR restore runs BEFORE the clear filter', () => {
        const src = readFileSync('src/services/rules/effects/restRules-longRest.js', 'utf8');
        const clearArray = src.match(/const LONG_REST_TARGET_EFFECT_CLEAR_KEYS = \[[\s\S]*?\n\]/)[0];
        expect(clearArray).toContain("'hp_max_reduce'");
        const restoreCall = src.search(/\n {2}restoreHpMaxDrainsOnLongRest\(campaignName\)/);
        const clearCall = src.search(/\n {2}clearLongRestCampaignTargetEffects\(campaignName\)/);
        expect(restoreCall).toBeGreaterThan(-1);
        expect(clearCall).toBeGreaterThan(-1);
        expect(restoreCall).toBeLessThan(clearCall);
    });
});

// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    parseConstant: vi.fn(() => null),
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

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn(),
    getActiveTargetEffect: vi.fn(() => null),
    getEffectDefinition: vi.fn((key) => ({ effect: key, label: key, group: 'Test' })),
}));

vi.mock('../../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';
import { playerIsImmuneToCondition } from '../../../services/combat/automation/automationService.js';
import { buildHitConditionClause } from '../../../components/encounter/MonsterCardHelpers.js';
import { registerTargetEffect, getEffectDefinition } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import { computeConditionEffects, combineAttackModes } from '../../../services/combat/conditions/conditionEffects.js';
import monsters from '../../../../public/data/monsters.json';

const TARGET = 'Bandit 1';

// Registry labels for the te lane (targetEffectDefinitions.js, MA-0016 family).
const TE_LABELS = {
    no_healing: "Can't Regain Hit Points",
    no_reactions: 'No Reactions',
    disadvantage_attack_rolls: 'Attack Disadvantage',
    disadvantage_next_attack: 'Disadv Next Attack',
    attached: 'Attached',
    speed_reduction: 'Speed Reduced',
    frozen_grip: 'Frozen Grip',
    distracting_strike_advantage: 'Next Attack Adv vs Target',
};

const deps = {
    characterName: TARGET,
    campaignName: 'test-campaign',
    characters: [
        { name: TARGET, computedStats: { armorClass: 12 } },
    ],
    setPopupHtml: vi.fn(),
    logEntry: vi.fn(),
    pendingSaves: {},
};

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    getEffectDefinition.mockImplementation((key) => ({ effect: key, label: TE_LABELS[key] || key, description: `${key} applied`, group: 'Test' }));
    applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 989, damageReduced: false });
    loadCombatSummary.mockResolvedValue({
        creatures: [{ name: TARGET, type: 'npc', size: 'Medium', ac: 12, currentHp: 999, maxHp: 999 }],
    });
});

function findAction(monsterIndex, actionName) {
    const monster = monsters.find(m => m.index === monsterIndex);
    const action = monster?.actions?.find(a => a.name === actionName);
    if (!action) throw new Error(`monsters.json row missing: ${monsterIndex} / ${actionName}`);
    return action;
}

function runtimeWrite(key) {
    return setRuntimeValue.mock.calls.find(c => c[1] === key);
}

function capitalize(c) {
    return c.charAt(0).toUpperCase() + c.slice(1);
}

function makeDeps(characterName) {
    return { ...deps, characterName, logEntry: vi.fn(), setPopupHtml: vi.fn() };
}

function conditionLogs(logEntry) {
    return logEntry.mock.calls.map(c => c[0]).filter(e => e.type === 'condition' && e.action === 'applied');
}

// One resolved-hit roll through the full lane with the row's clause attached.
async function resolveHit(action, attackerName) {
    const rowDeps = makeDeps(attackerName);
    const fn = createLogDamageAndShow(rowDeps);
    await fn({
        name: action.name,
        formula: action.damage_dice_primary,
        total: 10,
        rolls: [7],
        modifier: 3,
        context: {
            targetName: TARGET,
            damageType: action.damage_type_primary,
            attackerName,
            hitClause: buildHitConditionClause(action),
        },
    });
    return rowDeps.logEntry;
}

describe('buildHitConditionClause — generic clause shapes', () => {
    it('arms conditions + escapeDc from hit_conditions + escape_dc', () => {
        expect(buildHitConditionClause({ name: 'Tentacle Lash', attack_bonus: 7, hit_conditions: ['grappled', 'restrained'], escape_dc: 14 })).toEqual({
            conditions: ['grappled', 'restrained'],
            escapeDc: 14,
            attackName: 'Tentacle Lash',
            targetEffect: null,
        });
    });

    it('arms a targetEffect-only clause from hit_target_effect', () => {
        expect(buildHitConditionClause({ name: 'Claw', hit_target_effect: 'no_healing' })).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Claw',
            targetEffect: 'no_healing',
        });
    });

    it('arms the combined conditions + targetEffect clause', () => {
        expect(buildHitConditionClause({ name: 'Beard', hit_conditions: ['poisoned'], hit_target_effect: 'no_healing' })).toEqual({
            conditions: ['poisoned'],
            escapeDc: null,
            attackName: 'Beard',
            targetEffect: 'no_healing',
        });
    });

    it('returns null for actions without any hit rider', () => {
        expect(buildHitConditionClause(undefined)).toBeNull();
        expect(buildHitConditionClause({ name: 'Mind Rot', attack_bonus: 7 })).toBeNull();
        expect(buildHitConditionClause({ name: 'X', hit_conditions: [] })).toBeNull();
    });
});

// ── Table-driven generic lane over every authored monsters.json hit-clause row ──
// [index, action, attack_bonus, primary dice, damage type, hit_conditions, escape_dc, hit_target_effect]
// Expectations verified against public/data/monsters.json (MA-0010/0016/0018/0287/0288/0291/0302/0320/
// 0334/0335/0354/0361/0366/0434/0442/0443/0477/0480/0487/0490/0499/0508/0522/0527/0542/0546/0550/0553/
// 0556/0600/0602/0605/0609/0691/0704/0733/0984/0995/1012/1084/1240/1259/1273/1274/1435/1437/1531/1651/
// 1655/1664/1680/1688/1690/1723/1726/1727 lane family).
const HIT_CLAUSE_ROWS = [
    ['aberrant-cultist', 'Tentacle Lash', 7, '1d6 + 4', 'Slashing', ['grappled', 'restrained'], 14, null],
    ['aberrant-spirit-slaad', 'Claw', null, '1d10+3+spell level', 'Slashing', [], null, 'no_healing'],
    ['aboleth', 'Tentacle', 9, '2d6 + 5', 'Bludgeoning', ['grappled'], 14, null],
    ['ankylosaurus', 'Tail', 6, '1d10 + 4', 'Bludgeoning', ['prone'], null, null],
    ['arch-hag', 'Spectral Claw', 14, '3d6 + 7', 'Force', ['prone'], null, null],
    ['assassin', 'Shortsword', 7, '1d6 + 4', 'Piercing', ['poisoned'], null, null],
    ['animated-rug-of-smothering', 'Smother', 5, '2d6 + 3', 'Bludgeoning', ['blinded', 'grappled', 'restrained'], 13, null],
    ['ankheg', 'Bite', 5, '2d6 + 3', 'Slashing', ['grappled'], 13, null],
    ['balor', 'Flame Whip', 14, '3d6 + 8', 'Force', ['prone'], null, null],
    ['balor', 'Lightning Blade', 14, '3d8 + 8', 'Force', [], null, 'no_reactions'],
    ['barlgura', 'Thrash', 7, '1d10 + 4', 'Bludgeoning', ['prone'], null, null],
    ['barbed-devil', 'Claws', 6, '2d6 + 3', 'Piercing', ['grappled'], 13, null],
    ['bearded-devil', 'Beard', 5, '1d8 + 3', 'Piercing', ['poisoned'], null, 'no_healing'],
    ['brown-bear', 'Claw', 5, '1d4 + 3', 'Slashing', ['prone'], null, null],
    ['bugbear-stalker', 'Morningstar', 5, '2d8 + 3', 'Piercing', ['grappled'], 13, null],
    ['bugbear-warrior', 'Grab', 4, '2d6 + 2', 'Bludgeoning', ['grappled'], 12, null],
    ['centaur-warden', 'Sun Ray', 7, '3d6 + 4', 'Radiant', ['blinded'], null, null],
    ['chain-devil', 'Chain', 7, '2d6 + 4', 'Slashing', ['grappled', 'restrained'], 14, null],
    ['chimera', 'Ram', 7, '1d12 + 4', 'Bludgeoning', ['prone'], null, null],
    ['chuul', 'Pincer', 6, '1d10 + 4', 'Bludgeoning', ['grappled'], 14, null],
    ['cloud-giant', 'Thundercloud', 12, '3d6 + 8', 'Thunder', ['incapacitated'], null, null],
    ['colossus', 'Radiant Ray', 18, '4d10', 'Radiant', ['prone'], null, null],
    ['couatl', 'Bite', 7, '1d12 + 5', 'Piercing', ['poisoned'], null, null],
    ['crocodile', 'Bite', 4, '1d8 + 2', 'Piercing', ['grappled', 'restrained'], 12, null],
    ['cyclops-oracle', 'Flash of Light', 10, '2d10 + 6', 'Radiant', [], null, 'disadvantage_attack_rolls'],
    ['cyclops-sentry', 'Stone Club', 9, '3d6 + 6', 'Bludgeoning', ['prone'], null, null],
    ['darkmantle', 'Crush', 5, '1d6 + 3', 'Bludgeoning', [], null, 'attached'],
    ['dao', 'Earthen Maul', 10, '4d6 + 6', 'Bludgeoning', ['prone'], null, null],
    ['death-cultist', 'Dread Scythe', 7, '1d10 + 4', 'Slashing', [], null, 'no_healing'],
    ['dire-wolf', 'Bite', 5, '1d10 + 3', 'Piercing', ['prone'], null, null],
    ['dire-worg', 'Bite', 10, '2d8 + 6', 'Piercing', ['poisoned'], null, 'no_healing'],
    ['displacer-beast', 'Rend', 6, '1d10 + 4', 'Slashing', ['prone'], null, null],
    ['djinni', 'Storm Bolt', 9, '3d8', 'Thunder', ['prone'], null, null],
    ['empyrean', 'Sacred Weapon', 17, '6d6 + 10', 'Force', ['stunned'], null, null],
    ['ettercap', 'Bite', 4, '1d6 + 2', 'Piercing', ['poisoned'], null, null],
    ['fire-giant', 'Hammer Throw', 11, '3d10 + 7', 'Bludgeoning', [], null, 'disadvantage_next_attack'],
    ['giant-octopus', 'Tentacles', 5, '2d6 + 3', 'Bludgeoning', ['grappled', 'restrained'], 13, null],
    ['hobgoblin-warlord', 'Javelin', 6, '2d6 + 4', 'Piercing', [], null, 'speed_reduction'],
    ['ice-devil', 'Ice Spear', 10, '2d8 + 5', 'Piercing', [], null, 'frozen_grip'],
    ['hill-giant', 'Trash Lob', 8, '2d10 + 5', 'Bludgeoning', ['poisoned'], null, null],
    ['lich', 'Paralyzing Touch', 12, '3d6 + 5', 'Cold', ['paralyzed'], null, null],
    ['noble-prodigy', 'Beguiling Strike', 8, '4d6 + 4', 'Psychic', ['charmed'], null, null],
    ['oni', 'Nightmare Ray', 5, '2d6 + 2', 'Psychic', ['frightened'], null, null],
    ['otyugh', 'Bite', 6, '2d8 + 3', 'Piercing', ['poisoned'], null, null],
    ['otyugh', 'Tentacle', 6, '2d8 + 3', 'Piercing', ['grappled'], 13, null],
    ['satyr-revelmaster', 'Prance', 7, '2d8 + 4', 'Bludgeoning', ['charmed'], null, null],
    ['scarecrow', 'Fearsome Claw', 3, '2d4 + 1', 'Slashing', ['frightened'], null, null],
    ['stirge', 'Proboscis', 5, '1d6 + 3', 'Piercing', [], null, 'attached'],
    ['vampire-spawn', 'Claw', 6, '2d4 + 3', 'Slashing', ['grappled'], 13, null],
    ['vampire-umbral-lord', 'Sickening Ray', 10, '2d10 + 5', 'Necrotic', ['poisoned'], null, null],
    ['vine-blight', 'Constricting Vine', 4, '1d8 + 2', 'Bludgeoning', ['grappled'], 12, null],
    ['warrior-commander', 'Longbow', 9, '3d8 + 5', 'Piercing', [], null, 'speed_reduction'],
    ['worg', 'Bite', 5, '1d8 + 3', 'Piercing', [], null, 'distracting_strike_advantage'],
    ['water-elemental', 'Slam', 7, '2d8 + 4', 'Bludgeoning', ['prone'], null, null],
    ['water-weird', 'Surge', 5, '3d6 + 3', 'Cold', ['grappled', 'restrained'], 13, null],
    ['winter-wolf', 'Bite', 6, '2d6 + 4', 'Piercing', ['prone'], null, null],
    ['wolf', 'Bite', 4, '1d6 + 2', 'Piercing', ['prone'], null, null],
];

describe.each(HIT_CLAUSE_ROWS)('%s — %s hit-clause lane', (monsterIndex, actionName, attackBonus, dice, damageType, conditions, escapeDc, targetEffect) => {
    const monster = monsters.find(m => m.index === monsterIndex);
    const attackerName = `${monster.name} 1`;
    const action = findAction(monsterIndex, actionName);

    it('data-lock: row numerics and rider fields arm the expected clause', () => {
        expect(action.attack_bonus).toBe(attackBonus);
        expect(action.damage_dice_primary).toBe(dice);
        expect(action.damage_type_primary).toBe(damageType);
        expect(action.hit_conditions ?? []).toEqual(conditions);
        expect(action.escape_dc ?? null).toEqual(escapeDc);
        expect(action.hit_target_effect ?? null).toEqual(targetEffect);
        expect(buildHitConditionClause(action)).toEqual({
            conditions,
            escapeDc,
            attackName: actionName,
            targetEffect,
        });
    });

    it('grants on a resolved hit with provenance meta, pays damage once, and keeps lane-shaped writes honest', async () => {
        const logEntry = await resolveHit(action, attackerName);

        const damageLogs = logEntry.mock.calls.map(c => c[0]).filter(e => e.type === 'roll' && e.rollType === 'damage');
        expect(damageLogs.length).toBe(1);
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);

        if (conditions.length > 0) {
            const condCall = runtimeWrite('activeConditions');
            expect(condCall).toBeTruthy();
            expect(condCall[0]).toBe(TARGET);
            expect(condCall[2]).toEqual(conditions);
            expect(condCall[3]).toBe('test-campaign');

            const metaCall = runtimeWrite('activeConditionMeta');
            expect(metaCall).toBeTruthy();
            for (const cond of conditions) {
                expect(metaCall[2][cond]).toMatchObject({ source: attackerName });
                if (escapeDc != null) {
                    expect(metaCall[2][cond]).toMatchObject({ dc: escapeDc, ability: 'str' });
                } else {
                    expect(metaCall[2][cond].dc).toBeUndefined();
                    expect(metaCall[2][cond].ability).toBeUndefined();
                }
            }

            expect(conditionLogs(logEntry)).toContainEqual(expect.objectContaining({
                characterName: TARGET,
                condition: conditions.map(capitalize).join(', '),
                reason: escapeDc != null ? `${actionName} (escape DC ${escapeDc})` : `${actionName} (escape DC —)`,
            }));
        } else {
            expect(runtimeWrite('activeConditions')).toBeUndefined();
            expect(runtimeWrite('activeConditionMeta')).toBeUndefined();
        }

        if (targetEffect) {
            expect(registerTargetEffect).toHaveBeenCalledTimes(1);
            expect(registerTargetEffect).toHaveBeenCalledWith('test-campaign', TARGET, targetEffect, attackerName, { duration: 'until_start_of_next_turn' });
            // MA-0016 single-clock rule: ONE expiry anchored on the attacker.
            expect(addExpiration).toHaveBeenCalledTimes(1);
            expect(addExpiration).toHaveBeenCalledWith({
                attackerName,
                targetName: TARGET,
                effects: [{ type: 'remove_target_effect', effectKey: targetEffect, source: attackerName, target: TARGET }],
                campaignName: 'test-campaign',
                rounds: undefined,
                expireOnCreatureName: attackerName,
            });
            expect(conditionLogs(logEntry)).toContainEqual(expect.objectContaining({
                characterName: TARGET,
                condition: TE_LABELS[targetEffect],
                reason: `${actionName} — until the start of ${attackerName}'s next turn`,
            }));
        } else {
            expect(registerTargetEffect).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        }
    });
});

describe('hit-clause miss flows (generic)', () => {
    it('no hitClause in context (plain attack / miss leg) writes no condition state', async () => {
        const action = findAction('arch-hag', 'Spectral Claw');
        const rowDeps = makeDeps('Arch-hag 1');
        const fn = createLogDamageAndShow(rowDeps);
        await fn({ name: action.name, formula: '3d6 + 7', total: 17, rolls: [3, 4, 3], modifier: 7, context: {
            targetName: TARGET, damageType: 'Force', attackerName: 'Arch-hag 1',
        } });

        expect(runtimeWrite('activeConditions')).toBeUndefined();
        expect(runtimeWrite('activeConditionMeta')).toBeUndefined();
        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(conditionLogs(rowDeps.logEntry)).toHaveLength(0);
    });

    it('unresolved damage (applyDamageToTarget null) applies no clause', async () => {
        const action = findAction('arch-hag', 'Spectral Claw');
        applyDamageToTarget.mockReturnValue(null);
        const logEntry = await resolveHit(action, 'Arch-hag 1');

        expect(runtimeWrite('activeConditions')).toBeUndefined();
        expect(runtimeWrite('activeConditionMeta')).toBeUndefined();
        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(conditionLogs(logEntry)).toHaveLength(0);
    });

    it('does not duplicate conditions already active on the target', async () => {
        getRuntimeValue.mockImplementation((name, prop) => (prop === 'activeConditions' ? ['prone'] : null));
        const action = findAction('arch-hag', 'Spectral Claw');
        await resolveHit(action, 'Arch-hag 1');

        const condCall = runtimeWrite('activeConditions');
        expect(condCall[2].filter(c => String(c).toLowerCase() === 'prone')).toHaveLength(1);
    });
});

describe('hit-clause size gate (MA-0553/MA-1459 ladder)', () => {
    it.each([
        ['Medium', true],
        ['Small', true],
        ['Medium or Small', true],
        ['Large', true],
        ['Huge', false],
        ['Gargantuan', false],
    ])('%s victim passes gate: %s', async (size, grants) => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: TARGET, type: 'npc', size, ac: 12, currentHp: 999, maxHp: 999 }],
        });
        const action = findAction('arch-hag', 'Spectral Claw');
        const logEntry = await resolveHit(action, 'Arch-hag 1');

        if (grants) {
            expect(runtimeWrite('activeConditions')?.[2]).toEqual(['prone']);
        } else {
            expect(runtimeWrite('activeConditions')).toBeUndefined();
            expect(conditionLogs(logEntry)).toHaveLength(0);
        }
    });
});

describe('save-axis rows never arm the hit lane', () => {
    it.each([
        ['otyugh', 'Tentacle Slam', 14],
        ['vine-blight', 'Entangling Plants', 12],
        ['vampire-spawn', 'Bite', 14],
        ['scarecrow', 'Terrifying Glare', 11],
    ])('%s — %s (save_dc %i stays save-only)', (monsterIndex, actionName, saveDc) => {
        const action = findAction(monsterIndex, actionName);
        expect(action.save_dc).toBe(saveDc);
        expect(action.hit_conditions).toBeUndefined();
        expect(action.escape_dc).toBeUndefined();
        expect(action.hit_target_effect).toBeUndefined();
        expect(buildHitConditionClause(action)).toBeNull();
    });
});

describe('no_healing heal-block consumer (MA-0016/MA-0556 shape)', () => {
    it('the granted te shape is the shape isHealingBlocked reads', async () => {
        getRuntimeValue.mockImplementation((char, key) => {
            if (char === 'campaign' && key === 'targetEffects') {
                return [{ target: TARGET, effect: 'no_healing', source: 'Death Cultist 1', duration: 'until_start_of_next_turn' }];
            }
            return null;
        });
        const { getHealingBlockEffect, isHealingBlocked } = await import('../../../services/rules/combat/healingBlock.js');
        expect(getHealingBlockEffect(TARGET, 'test-campaign')).toMatchObject({ effect: 'no_healing', source: 'Death Cultist 1' });
        expect(isHealingBlocked(TARGET, 'test-campaign', 5)).toMatchObject({ effect: 'no_healing' });
    });
});

describe('hit-clause te consumers (conditionEffects channels)', () => {
    it.each([
        ['disadvantage_attack_rolls', 'attackDisadvantageCount', 'disadvantage'],
        ['disadvantage_next_attack', 'attackDisadvantageCount', 'disadvantage'],
        ['distracting_strike_advantage', 'targetAdvantageCount', 'advantage'],
    ])('%s folds into combineAttackModes as %s', (te, countKey, mode) => {
        const fx = computeConditionEffects({ targetEffects: [{ effect: te, target: TARGET, source: 'Attacker 1' }] });
        expect(fx[countKey]).toBeGreaterThanOrEqual(1);
        const empty = computeConditionEffects({});
        const combined = mode === 'disadvantage'
            ? combineAttackModes(fx, empty, null, TARGET)
            : combineAttackModes(empty, fx, null, TARGET);
        expect(combined).toBe(mode);
    });
});

// SP-094: PFEG ward immunity — a Charmed/Frightened on-hit rider from a
// warded creature type is suppressed with a refusal log; other hits inert-safe.
describe('SP-094 hit-clause PFEG ward immunity', () => {
    const CHARMFING_HIT_ACTION = { name: 'Touch', attack_bonus: 7, damage_dice_primary: '1d8 + 4', damage_type_primary: 'Psychic', hit_conditions: ['charmed'] };

    beforeEach(() => {
        applyDamageToTarget.mockReturnValue({ finalDamage: 12, newHp: 47, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [
                { name: 'War_Cleric', type: 'player', size: 'Medium', ac: 12, currentHp: 59, maxHp: 59 },
                { name: 'Succubus 1', type: 'npc', monsterType: 'Fiend', size: 'Medium' },
            ],
        });
        playerIsImmuneToCondition.mockImplementation(({ conditionKey, playerStats }) => (
            playerStats?.name === 'War_Cleric' && (conditionKey === 'charmed' || conditionKey === 'frightened')
        ));
        getRuntimeValue.mockImplementation((name, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'activeBuffs') return [{ effect: 'protection_from_evil_and_good' }];
            if (prop === 'protectionFromEvilAndGoodWardedTypes') return ['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'];
            return null;
        });
    });

    async function succubusTouch() {
        const fn = createLogDamageAndShow({ ...deps, characterName: 'Succubus 1' });
        await fn({ name: 'Touch', formula: '1d8 + 4', total: 12, rolls: [8], modifier: 4, context: {
            targetName: 'War_Cleric', damageType: 'Psychic', attackerName: 'Succubus 1',
            hitClause: buildHitConditionClause(CHARMFING_HIT_ACTION),
        } });
    }

    it('warded charmed-on-hit is blocked: no condition write, refusal logged', async () => {
        await succubusTouch();

        const condCall = setRuntimeValue.mock.calls.find(c => c[0] === 'War_Cleric' && c[1] === 'activeConditions');
        expect(condCall).toBeUndefined();
        const blocked = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.type === 'automation blocked');
        expect(blocked).toBeTruthy();
        expect(blocked).toMatchObject({ characterName: 'War_Cleric', sourceName: 'Succubus 1', abilityName: 'Touch' });
        expect(blocked.description).toMatch(/Fiend/);
    });

    it('non-warded charmed-on-hit lands', async () => {
        playerIsImmuneToCondition.mockReturnValue(false);
        await succubusTouch();

        const condCall = setRuntimeValue.mock.calls.find(c => c[0] === 'War_Cleric' && c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['charmed']);
    });
});

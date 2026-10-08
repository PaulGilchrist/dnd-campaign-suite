// FT-103: Polearm Master Reactive Strike reaction lane — clickable GM-armed
// reach-entry adjudication: equipped-polearm gate (playerStats.inventory.equipped,
// never campaign-global lastAttack identity), target = armed entering creature
// (never lastAttack.attackerName), once-per-round reaction latch
// _Reactive_Strike_usedRound from a FRESH getCombatContext, spend + refusal logs.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionDamageHandler.js';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 15),
    createSaveListener: vi.fn(() => ({ promptId: 'p', promise: Promise.resolve({ success: true }) })),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [3, 2] })),
}));

const runtimeStore = {};
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((characterKey, propertyName) => runtimeStore[`${characterKey}.${propertyName}`]),
    setRuntimeValue: vi.fn(async (characterKey, propertyName, value) => {
        runtimeStore[`${characterKey}.${propertyName}`] = value;
    }),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 1),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(async () => ({})),
    computeDamageAfterSave: vi.fn((raw, saveSuccess) => (saveSuccess ? 0 : raw)),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
    getAbilityModifier: vi.fn(() => 2),
}));

vi.mock('../../../combat/baseCombatActions.js', () => ({
    MELEE_REACH_FEET: 5,
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../common/polearmUtils.js', () => ({
    isPolearmWeapon: vi.fn(async () => false),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { resolveTarget } = await import('../../common/targetResolver.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { findLastAttack } = await import('../../common/damageRollback.js');
const { isPolearmWeapon } = await import('../../common/polearmUtils.js');
const { isWithinRange } = await import('../../../rules/combat/rangeCheck.js');

const campaignName = 'test-campaign';
const LATCH_KEY = '_Reactive_Strike_usedRound';

const AUTO = {
    type: 'reaction_damage',
    trigger: 'creature_enters_reach_while_holding_polearm',
    range: '5_ft',
    effect: 'melee_attack',
    casting_time: '1 reaction',
};

function makeAction() {
    return { name: 'Reactive Strike', description: 'Reach-entry melee attack', automation: AUTO };
}

function polearmFighter(overrides = {}) {
    return {
        name: 'EvasiveFighter',
        level: 18,
        rules: '2024',
        inventory: { equipped: ['Glaive'] },
        attacks: [
            { name: 'Glaive', type: 'Action', range: 5, hitBonus: 8, damage: '1d10+2', damageType: 'Slashing' },
        ],
        ...overrides,
    };
}

function armedTarget(name = 'Bandit 1') {
    resolveTarget.mockResolvedValue({ target: { name } });
}

function csRound(round, creatures = [{ name: 'Bandit 1', currentHp: 11 }]) {
    getCombatContext.mockResolvedValue({ round, creatures });
}

beforeEach(() => {
    // clearAllMocks (not resetAllMocks — §45: keep factory implementations alive,
    // the runtime-store mock must stay wired across the latch economy tests).
    vi.clearAllMocks();
    Object.keys(runtimeStore).forEach(k => delete runtimeStore[k]);
    getRuntimeValue.mockImplementation((characterKey, propertyName) => runtimeStore[`${characterKey}.${propertyName}`]);
    setRuntimeValue.mockImplementation(async (characterKey, propertyName, value) => {
        runtimeStore[`${characterKey}.${propertyName}`] = value;
    });
    addEntry.mockImplementation(() => Promise.resolve());
    isPolearmWeapon.mockImplementation(async (name) => ['Glaive', 'Quarterstaff', 'Spear'].includes(name));
    isWithinRange.mockResolvedValue(true);
    csRound(1);
    armedTarget();
    findLastAttack.mockResolvedValue({ attackEvent: { attackName: 'Scimitar', damageName: 'Scimitar' }, attackerName: 'Bandit 1' });
});

describe('FT-103 Reactive Strike lane', () => {
    it('resolves attack_roll against the armed entering creature, not lastAttack.attackerName', async () => {
        armedTarget('Thug');
        findLastAttack.mockResolvedValue({ attackEvent: { attackName: 'Scimitar' }, attackerName: 'GhostAttacker' });

        const result = await handle(makeAction(), polearmFighter(), campaignName, null, []);

        expect(result.type).toBe('attack_roll');
        expect(result.payload.targetName).toBe('Thug');
        expect(result.payload.targetName).not.toBe('GhostAttacker');
        expect(findLastAttack).not.toHaveBeenCalled();
    });

    it('uses the equipped polearm attack row (Glaive 1d10+2 Slashing) as the RAW dice source', async () => {
        const result = await handle(makeAction(), polearmFighter(), campaignName, null, []);

        expect(result.payload.attack).toMatchObject({
            name: 'Glaive', hitBonus: 8, damage: '1d10+2', damageType: 'Slashing',
        });
    });

    it('prefers the melee polearm row over a same-name thrown ranged row', async () => {
        const fighter = polearmFighter({
            inventory: { equipped: ['Spear'] },
            attacks: [
                { name: 'Spear', type: 'Action', range: 5, hitBonus: 8, damage: '1d6+3', damageType: 'Piercing' },
                { name: 'Spear', type: 'Action', range: 20, hitBonus: 8, damage: '1d6+3', damageType: 'Piercing' },
            ],
        });

        const result = await handle(makeAction(), fighter, campaignName, null, []);
        expect(result.payload.attack.range).toBe(5);
    });

    it('spends the Reaction: stamps _Reactive_Strike_usedRound at the fresh cs round and logs ability_use', async () => {
        csRound(3);

        const result = await handle(makeAction(), polearmFighter(), campaignName, null, []);

        expect(result.type).toBe('attack_roll');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', LATCH_KEY, 3, campaignName);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'EvasiveFighter',
            abilityName: 'Reactive Strike',
            targetName: 'Bandit 1',
        }));
    });

    it('refuses a second use in the same round: popup + reactive_strike_refused log, zero spend', async () => {
        await handle(makeAction(), polearmFighter(), campaignName, null, []);
        addEntry.mockClear();
        setRuntimeValue.mockClear();

        const second = await handle(makeAction(), polearmFighter(), campaignName, null, []);

        expect(second.type).toBe('popup');
        expect(second.payload.description).toContain('already used');
        expect(getRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', LATCH_KEY, campaignName);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'automation',
            automationType: 'reactive_strike_refused',
            characterName: 'EvasiveFighter',
        }));
        expect(addEntry.mock.calls.every(([, e]) => e.type !== 'ability_use')).toBe(true);
    });

    it('re-arms next round: latch from round 1 does not refuse at round 2 and re-stamps round 2', async () => {
        runtimeStore[`EvasiveFighter.${LATCH_KEY}`] = 1;
        csRound(2);

        const result = await handle(makeAction(), polearmFighter(), campaignName, null, []);

        expect(result.type).toBe('attack_roll');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', LATCH_KEY, 2, campaignName);
    });

    it('refuses with no polearm equipped: popup + refusal log, no latch stamp, no attack', async () => {
        const fighter = polearmFighter({
            inventory: { equipped: ['Scimitar'] },
            attacks: [{ name: 'Scimitar', type: 'Action', range: 5, hitBonus: 8, damage: '1d6+4', damageType: 'Slashing' }],
        });

        const result = await handle(makeAction(), fighter, campaignName, null, []);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('requires you to be holding');
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            automationType: 'reactive_strike_refused',
        }));
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('ignores a stale polearm lastAttack when nothing polearm is equipped (FT-102 gate family)', async () => {
        const fighter = polearmFighter({
            inventory: { equipped: ['Scimitar'] },
            attacks: [{ name: 'Scimitar', type: 'Action', range: 5, hitBonus: 8, damage: '1d6+4', damageType: 'Slashing' }],
        });
        findLastAttack.mockResolvedValue({ attackEvent: { damageName: 'Glaive', attackName: 'Glaive' }, attackerName: 'Bandit 1' });

        const result = await handle(makeAction(), fighter, campaignName, null, []);
        expect(result.type).toBe('popup');
        expect(findLastAttack).not.toHaveBeenCalled();
    });

    it('refuses without an armed target, nothing spent', async () => {
        resolveTarget.mockResolvedValue(null);

        const result = await handle(makeAction(), polearmFighter(), campaignName, null, []);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('requires a target');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            automationType: 'reactive_strike_refused',
        }));
    });

    it('refuses a self-armed target', async () => {
        armedTarget('EvasiveFighter');

        const result = await handle(makeAction(), polearmFighter(), campaignName, null, []);
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('cannot attack yourself');
    });

    it('refuses a downed entering creature', async () => {
        csRound(1, [{ name: 'Bandit 1', currentHp: 0 }]);

        const result = await handle(makeAction(), polearmFighter(), campaignName, null, []);
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('already defeated');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses when the entering creature is out of range', async () => {
        isWithinRange.mockResolvedValue(false);

        const result = await handle(makeAction(), polearmFighter(), campaignName, null, []);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('not within 5 feet');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(isWithinRange).toHaveBeenCalledWith('EvasiveFighter', 'Bandit 1', 5);
    });

    it('round latch refuses BEFORE the equipped-polearm gate (spent-Reaction authoritative guard)', async () => {
        runtimeStore[`EvasiveFighter.${LATCH_KEY}`] = 1;
        const fighter = polearmFighter({
            inventory: { equipped: ['Scimitar'] },
            attacks: [{ name: 'Scimitar', type: 'Action', range: 5, hitBonus: 8, damage: '1d6+4', damageType: 'Slashing' }],
        });

        const result = await handle(makeAction(), fighter, campaignName, null, []);
        expect(result.payload.description).toContain('already used');
        expect(result.payload.description).not.toContain('requires you to be holding');
    });
});

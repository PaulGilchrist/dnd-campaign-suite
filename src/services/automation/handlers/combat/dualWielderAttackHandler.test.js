// @maintained-by-ai
// FT-104: Dual Wielder dedicated bonus-attack lane — single off-hand attack,
// own-turn gate, once-per-turn latch, refusal logs, no Flurry multi-fire.
// Deterministic contract suite: mocks the four seams (runtime store, damageUtils,
// logService, combatData) and pins the gate/latch/attack_roll contract of
// dualWielderAttackHandler.js. Round-wrap clearing of _DualWielder_UsedRound is
// owned by Initiative.jsx / navigationHandlers PLAYER_ROUND_LATCH_KEYS — here we
// only pin that a stale (prior-round) latch round does not block a new round.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './dualWielderAttackHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 4),
    getCombatSummary: vi.fn(() => null),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

const CAMPAIGN_NAME = 'test-campaign';

function makeAction() {
    return {
        name: 'Enhanced Dual Wielding',
        description: 'One extra attack with a different melee weapon.',
        automation: {
            type: 'dual_wielder_attack',
            trigger: 'attack_action_with_light_weapon',
            extraAttacks: 1,
            casting_time: '1 bonus action',
        },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'EvasiveFighter',
        proficiency: 3,
        attacks: [
            { name: 'Scimitar', type: 'Action', weaponType: 'melee', hitBonus: 9, damage: '1d6+6', damageType: 'Slashing', range: 5, properties: ['Light', 'Finesse'] },
            { name: 'Shortbow', type: 'Action', weaponType: 'ranged', hitBonus: 6, damage: '1d6+0', damageType: 'Piercing', range: 80, properties: ['Ammunition'] },
            { name: 'Dual Wielder Extra Attack', type: 'Bonus Action', weaponType: 'melee', weaponName: 'Shortsword', hitBonus: 6, damage: '1d6', damageType: 'Piercing', range: 5, properties: ['Light', 'Finesse'] },
        ],
        ...overrides,
    };
}

const CS = { round: 4, activeCreatureName: 'EvasiveFighter', creatures: [{ name: 'Bandit' }] };

describe('dualWielderAttackHandler (FT-104)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCombatContext).mockResolvedValue(CS);
        vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Bandit', type: 'npc' });
        vi.mocked(getRuntimeValue).mockReturnValue(null);
        vi.mocked(getCurrentCombatRound).mockReturnValue(4);
    });

    it('fires exactly ONE attack_roll with the off-hand row dice-only damage vs the armed target — never a Flurry modal', async () => {
        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);

        // FT-104 regression: this feature was mis-routed to the monk Flurry
        // handler (modal + multi-fire). Single adjudicated attack_roll only.
        expect(result.type).toBe('attack_roll');
        expect(result.modalName).toBeUndefined();
        expect(result.payload.targetName).toBe('Bandit');
        expect(result.payload.attack.damage).toBe('1d6'); // dice only — no ability mod, no Shortbow
        expect(result.payload.attack.damageType).toBe('Piercing');
        expect(result.payload.attack.hitBonus).toBe(6);
        expect(result.payload.attack.range).toBe(5);
        expect(result.payload.attack.name).toContain('Shortsword');
        // ability_use logged
        const abilityUse = vi.mocked(addEntry).mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
        expect(abilityUse).toBeTruthy();
    });

    it('stamps _DualWielder_UsedRound awaited with campaignName-threaded round; a stale prior-round latch re-arms', async () => {
        // CLA-371 serialize: awaited stamp BEFORE the attack returns, so a
        // second same-round click reads the stamped round and is refused.
        const first = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);
        expect(first.type).toBe('attack_roll');
        expect(getCurrentCombatRound).toHaveBeenCalledWith(CAMPAIGN_NAME);
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_DualWielder_UsedRound', 4, CAMPAIGN_NAME);

        // Round-wrap re-arm: a latch stamped in a prior round (3) must not
        // block the current round (4).
        vi.mocked(getRuntimeValue).mockImplementation((_n, key) => (key === '_DualWielder_UsedRound' ? 3 : null));
        vi.mocked(setRuntimeValue).mockClear();
        const wrapped = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);
        expect(wrapped.type).toBe('attack_roll');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_DualWielder_UsedRound', 4, CAMPAIGN_NAME);
    });

    it('refuses a second same-turn click: dual_wielder_refused log + popup, zero attack, zero new latch write', async () => {
        vi.mocked(getRuntimeValue).mockImplementation((_n, key) => (key === '_DualWielder_UsedRound' ? 4 : null));

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/Once per turn/);
        const refusal = vi.mocked(addEntry).mock.calls.map(c => c[1]).find(e => e.automationType === 'dual_wielder_refused');
        expect(refusal).toBeTruthy();
        expect(refusal.description).toMatch(/dual_wielder_refused|refused/);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses when it is not your turn', async () => {
        vi.mocked(getCombatContext).mockResolvedValue({ ...CS, activeCreatureName: 'Bandit' });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/Bandit's turn/);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('uses __initiative__ turn-walk authority over the stale cs mirror: fires on your turn, refuses on others', async () => {
        // FT-104 live: cs.activeCreatureName stayed "Wild_Sage_Druid" while the
        // walk authority gate was "4:EvasiveFighter".
        vi.mocked(getCombatContext).mockResolvedValue({ ...CS, activeCreatureName: 'Wild_Sage_Druid' });
        vi.mocked(getRuntimeValue).mockImplementation((_n, key) => {
            if (key === '_DualWielder_UsedRound') return null;
            if (key === 'lastAppliedTurnStartCreature') return '4:EvasiveFighter';
            return null;
        });
        const mine = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);
        expect(mine.type).toBe('attack_roll');

        vi.mocked(getRuntimeValue).mockImplementation((_n, key) => {
            if (key === '_DualWielder_UsedRound') return null;
            if (key === 'lastAppliedTurnStartCreature') return '4:Wild_Sage_Druid';
            return null;
        });
        vi.mocked(setRuntimeValue).mockClear();
        const theirs = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);
        expect(theirs.type).toBe('popup');
        expect(theirs.payload.description).toMatch(/Wild_Sage_Druid's turn/);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses with no armed target — no attack, no latch spend', async () => {
        vi.mocked(getTargetFromAttacker).mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/No target/);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses when no off-hand dual-wielder row exists (single weapon)', async () => {
        const stats = makePlayerStats({
            attacks: [{ name: 'Shortsword', type: 'Action', weaponType: 'melee', hitBonus: 6, damage: '1d6+2', damageType: 'Piercing', range: 5, properties: ['Light'] }],
        });

        const result = await handle(makeAction(), stats, CAMPAIGN_NAME);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/two melee weapons/);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses when the dual-wielder row is a Two-Handed weapon (handler-side guard)', async () => {
        // attackCalc2024 never builds such a row, but pickDualWielderRow guards
        // defensively — pin the handler branch too.
        const stats = makePlayerStats({
            attacks: [
                { name: 'Scimitar', type: 'Action', weaponType: 'melee', hitBonus: 9, damage: '1d6+6', damageType: 'Slashing', range: 5, properties: ['Light', 'Finesse'] },
                { name: 'Dual Wielder Extra Attack', type: 'Bonus Action', weaponType: 'melee', weaponName: 'Greatsword', hitBonus: 6, damage: '2d6', damageType: 'Slashing', range: 5, properties: ['Two-Handed'] },
            ],
        });

        const result = await handle(makeAction(), stats, CAMPAIGN_NAME);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/two melee weapons/);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses outside combat context', async () => {
        vi.mocked(getCombatContext).mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);

        expect(result.type).toBe('popup');
        const refusal = vi.mocked(addEntry).mock.calls.map(c => c[1]).find(e => e.automationType === 'dual_wielder_refused');
        expect(refusal).toBeTruthy();
    });
});

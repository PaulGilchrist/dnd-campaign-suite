// MN-014: Precision Attack (trigger attack_roll_miss) was offered on HITS
// because the hit-branch query only gated weapon/melee TYPE, never hit/miss.
// Both entry points must now share the trigger matcher, and miss-context
// options must carry effect/damageBonus so the consumer can route them.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getAvailableAttackRiderManeuvers,
    getAvailableAttackRiderManeuversByTrigger,
    getManeuversForRules,
} from './combatSuperiorityQueries.js';
import {
    getAttackRiderOptions,
    getAttackRiderOptionsByContext,
} from './dispatchers.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async () => [
        { name: 'Precision Attack', actionType: 'attack_rider', trigger: 'attack_roll_miss', effect: 'attack_roll_bonus', damageBonus: false, dieExpression: 'superiority_die' },
        { name: 'Menacing Attack', actionType: 'attack_rider', trigger: 'weapon_attack_hit', effect: 'frightened', saveType: 'WIS', damageBonus: true, dieExpression: 'superiority_die' },
        { name: 'Sweeping Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit', effect: 'secondary_damage', damageBonus: false, dieExpression: 'superiority_die' },
    ]),
}));

const CAMPAIGN = 'test-campaign';
const stats = () => ({ name: 'EvasiveFighter', rules: '2024' });

describe('MN-014 — Precision Attack trigger routing', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'BattleMasterManeuvers_selection') return ['Precision Attack', 'Menacing Attack', 'Sweeping Attack'];
            if (key === 'superiorityDice') return 4;
            return undefined;
        });
        await getManeuversForRules('2024');
    });

    const names = (list) => list.map(m => m.name);

    it('excludes Precision Attack from HIT rider options (pipeline chooser)', async () => {
        const hitOptions = await getAttackRiderOptions(stats(), CAMPAIGN, { weaponType: 'melee', hit: true });
        expect(names(hitOptions)).not.toContain('Precision Attack');
        expect(names(hitOptions)).toContain('Menacing Attack');
        expect(names(hitOptions)).toContain('Sweeping Attack');
    });

    it('excludes Precision Attack from hit maneuvers (shared query)', () => {
        const hit = getAvailableAttackRiderManeuvers(stats(), CAMPAIGN, { weaponType: 'melee', hit: true });
        expect(names(hit)).not.toContain('Precision Attack');
        expect(names(hit)).toEqual(expect.arrayContaining(['Menacing Attack', 'Sweeping Attack']));
    });

    it('still offers Precision Attack on a MISS (both entry points)', () => {
        expect(names(getAvailableAttackRiderManeuversByTrigger(stats(), CAMPAIGN, { weaponType: 'melee', hit: false }))).toEqual(['Precision Attack']);
        expect(names(getAvailableAttackRiderManeuvers(stats(), CAMPAIGN, { weaponType: 'melee', hit: false }))).toEqual(['Precision Attack']);
    });

    it('miss-context options carry effect/damageBonus for the consumer router', async () => {
        const options = await getAttackRiderOptionsByContext(stats(), CAMPAIGN, { weaponType: 'melee', hit: false }, 'miss');
        expect(options).toHaveLength(1);
        expect(options[0]).toEqual(expect.objectContaining({
            name: 'Precision Attack',
            effect: 'attack_roll_bonus',
            damageBonus: false,
            context: 'miss',
        }));
    });

    it('hit-context options exclude Precision Attack', async () => {
        const options = await getAttackRiderOptionsByContext(stats(), CAMPAIGN, { weaponType: 'melee', hit: true }, 'hit');
        expect(names(options)).not.toContain('Precision Attack');
    });
});

// MN-018: HIT-triggered attack-rider riders must NOT be offered on a MISS,
// and the per-trigger filter must never default-true for unknown triggers.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getAvailableAttackRiderManeuversByTrigger,
    getManeuversForRules,
} from './combatSuperiorityQueries.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async () => [
        { name: 'Sweeping Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit', effect: 'secondary_damage', damageBonus: false, dieExpression: 'superiority_die' },
        { name: 'Menacing Attack', actionType: 'attack_rider', trigger: 'weapon_attack_hit', effect: 'frightened', saveType: 'WIS', damageBonus: true, dieExpression: 'superiority_die' },
        { name: 'Precision Attack', actionType: 'attack_rider', trigger: 'attack_roll_miss', effect: 'attack_roll_bonus', dieExpression: 'superiority_die' },
        { name: 'Mystery Rider', actionType: 'attack_rider', trigger: 'some_unknown_trigger', effect: 'x' },
    ]),
}));

const CAMPAIGN = 'test-campaign';

const stats = () => ({ name: 'EvasiveFighter', rules: '2024' });

describe('getAvailableAttackRiderManeuversByTrigger — MN-018 offer gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'BattleMasterManeuvers_selection') return ['Sweeping Attack', 'Menacing Attack', 'Precision Attack', 'Mystery Rider'];
            if (key === 'superiorityDice') return 4;
            return undefined;
        });
    });

    const namesFor = (attackInfo) => {
        const got = getAvailableAttackRiderManeuversByTrigger(stats(), CAMPAIGN, attackInfo).map(m => m.name);
        return got;
    };

    it('offers Sweeping Attack on a MELEE HIT', async () => {
        await getManeuversForRules('2024');
        const names = namesFor({ weaponType: 'melee', hit: true });
        expect(names).toContain('Sweeping Attack');
    });

    it('does NOT offer Sweeping Attack on a MELEE MISS (trigger fail-open)', async () => {
        await getManeuversForRules('2024');
        const names = namesFor({ weaponType: 'melee', hit: false });
        expect(names).not.toContain('Sweeping Attack');
    });

    it('does NOT offer weapon_attack_hit riders on a miss', async () => {
        await getManeuversForRules('2024');
        const names = namesFor({ weaponType: 'melee', hit: false });
        expect(names).not.toContain('Menacing Attack');
    });

    it('offers weapon_attack_hit riders on a hit', async () => {
        await getManeuversForRules('2024');
        const names = namesFor({ weaponType: 'melee', hit: true });
        expect(names).toContain('Menacing Attack');
    });

    it('still offers Precision Attack on a miss', async () => {
        await getManeuversForRules('2024');
        const names = namesFor({ weaponType: 'melee', hit: false });
        expect(names).toContain('Precision Attack');
    });

    it('does NOT default-offer an unrecognized trigger', async () => {
        await getManeuversForRules('2024');
        expect(namesFor({ weaponType: 'melee', hit: true })).not.toContain('Mystery Rider');
    });
});

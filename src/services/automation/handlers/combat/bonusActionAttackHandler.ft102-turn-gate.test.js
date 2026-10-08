// FT-102: Polearm Master / Pole Strike "immediately after the Attack action"
// gate. The old checkPolearmRequirement only matched the weapon name on the
// campaign-global lastAttack — a stale polearm lastAttack from a previous turn
// (or another creature's polearm lastAttack) fired the bonus attack with no
// Attack action this turn. The fix reuses the verified CLA-143 round latch
// `_attackActionTakenRound` (armed by the Attack-action row lane in
// useCharActionsAttackHandlers.js) + requires lastAttack.attackerName to be
// the player, with the round read fresh from getCombatContext (playbook §5).
// @generated-by-ai
// @schema-version: 1
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './bonusActionAttackHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../common/polearmUtils.js', () => ({
    isPolearmWeapon: vi.fn(),
}));

vi.mock('../../../combat/baseCombatActions.js', () => ({
    MELEE_REACH_FEET: 5,
}));

vi.mock('../../../shared/popupResponse.js', () => ({
    automationInfoPopup: vi.fn((action) => ({
        type: 'popup',
        payload: { type: 'automation_info', name: action.name, automation: action.automation },
    })),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { isPolearmWeapon } from '../../common/polearmUtils.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

const CAMPAIGN = 'test-campaign';
const PLAYER = 'EvasiveFighter';

const poleStrikeAction = () => ({
    name: 'Pole Strike',
    description: 'Bonus action attack with the opposite end of the weapon.',
    automation: {
        type: 'bonus_action_attack',
        action: 'bonus_action',
        damage: '1d4',
        damageType: 'Bludgeoning',
        weaponRequirement: 'quarterstaff_spear_heavy_reach',
        trigger: 'after_attack_action_with_polearm',
        casting_time: '1 bonus action',
    },
});

const playerStats = () => ({ name: PLAYER, proficiency: 8, attacks: [] });

// Arm every fresh-turn input: CLA-143 latch + fresh combat round + own
// polearm lastAttack resolved this round (mirrors useCharActionsAttackHandlers).
function armFreshPoleAttack({ round = 2, weapon = 'Glaive' } = {}) {
    isPolearmWeapon.mockResolvedValue(true);
    getCombatContext.mockResolvedValue({ round });
    getRuntimeValue.mockImplementation((name, key) => (
        key === '_attackActionTakenRound' ? round : null
    ));
    findLastAttack.mockResolvedValue({
        attackEvent: { attackerName: PLAYER, attackName: weapon, bonus: 8, hit: true },
        targetName: 'Bandit 1',
    });
}

function refusalLogCalls() {
    return addEntry.mock.calls
        .map(([, entry]) => entry)
        .filter(e => e && e.type === 'automation' && /_refused$/.test(e.automationType || ''));
}

describe('FT-102 Pole Strike Attack-action turn gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fires the d4 attack_roll when the player attacked with a polearm this turn', async () => {
        armFreshPoleAttack();

        const result = await handle(poleStrikeAction(), playerStats(), CAMPAIGN, 'map', []);

        expect(result.type).toBe('attack_roll');
        expect(result.payload.attack.autoDamageFormula).toBe('1d4');
        expect(result.payload.attack.damageType).toBe('Bludgeoning');
        expect(result.payload.attack.name).toBe('Pole Strike');
        expect(result.payload.targetName).toBe('Bandit 1');
        expect(refusalLogCalls()).toHaveLength(0);
    });

    it('refuses with popup + pole_strike_refused log when the polearm lastAttack is from a previous round', async () => {
        armFreshPoleAttack({ round: 2 });
        // Repro of the FT-102 exploit: round advanced to 3, Attack action
        // (and lastAttack) still stamp round 2 — stale-turn click.
        getCombatContext.mockResolvedValue({ round: 3 });

        const result = await handle(poleStrikeAction(), playerStats(), CAMPAIGN, 'map', []);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('on your current turn');
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'automation',
            automationType: 'pole_strike_refused',
            characterName: PLAYER,
        }));
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses when the latch was never armed this round even with a fresh polearm lastAttack', async () => {
        armFreshPoleAttack({ round: 2 });
        getRuntimeValue.mockImplementation(() => null);

        const result = await handle(poleStrikeAction(), playerStats(), CAMPAIGN, 'map', []);

        expect(result.type).toBe('popup');
        expect(refusalLogCalls()).toHaveLength(1);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses when the last polearm attack belongs to another creature', async () => {
        armFreshPoleAttack({ round: 2 });
        findLastAttack.mockResolvedValue({
            attackEvent: { attackerName: 'Bandit 1', attackName: 'Glaive', bonus: 5 },
            targetName: PLAYER,
        });

        const result = await handle(poleStrikeAction(), playerStats(), CAMPAIGN, 'map', []);

        expect(result.type).toBe('popup');
        expect(refusalLogCalls()).toHaveLength(1);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('keeps the byte-identical weapon-refusal popup (and now logs it) for a non-polearm lastAttack', async () => {
        armFreshPoleAttack({ round: 2 });
        isPolearmWeapon.mockResolvedValue(false);
        findLastAttack.mockResolvedValue({
            attackEvent: { attackerName: PLAYER, attackName: 'Scimitar' },
            targetName: 'Bandit 1',
        });

        const result = await handle(poleStrikeAction(), playerStats(), CAMPAIGN, 'map', []);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Pole Strike requires you to be holding a Quarterstaff, Spear, or a weapon with the Heavy and Reach properties.',
        );
        expect(refusalLogCalls()).toHaveLength(1);
    });

    it('refuses the second click of the same Attack action (lastAttack is now Pole Strike)', async () => {
        armFreshPoleAttack({ round: 2 });

        const first = await handle(poleStrikeAction(), playerStats(), CAMPAIGN, 'map', []);
        expect(first.type).toBe('attack_roll');

        // Once Pole Strike resolves, lastAttack.identity is 'Pole Strike' —
        // not a polearm name — so the existing identity check refuses again.
        vi.clearAllMocks();
        armFreshPoleAttack({ round: 2, weapon: 'Pole Strike' });
        isPolearmWeapon.mockResolvedValue(false);

        const second = await handle(poleStrikeAction(), playerStats(), CAMPAIGN, 'map', []);

        expect(second.type).toBe('popup');
        expect(refusalLogCalls()).toHaveLength(1);
    });
});

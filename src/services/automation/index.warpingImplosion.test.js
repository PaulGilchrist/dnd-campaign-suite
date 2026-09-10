// CLA-384: Warping Implosion ships type 'save_attack' so the generic handler
// always won and the dedicated warping_implosion handler was unreachable —
// executeHandler must route the sorcery_points+restoreCost fingerprint to it.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { executeHandler } from './index.js';
import { handle as handleSaveAttack } from './handlers/combat/saveAttackHandler.js';
import { handle as handleWarpingImplosion } from './handlers/class-sorcerer/warpingImplosionHandler.js';

vi.mock('./handlers/combat/saveAttackHandler.js', () => ({
    handle: vi.fn(async () => ({ type: 'popup', payload: { type: 'automation_info', name: 'GENERIC' } })),
}));

vi.mock('./handlers/class-sorcerer/warpingImplosionHandler.js', () => ({
    handle: vi.fn(async () => ({ type: 'modal', modalName: 'warpingImplosion', payload: { teleportRange: 120 } })),
}));

const playerStats = { name: 'AberrantSorcerer', level: 18 };

function makeImplosionAction() {
    return {
        name: 'Warping Implosion',
        automation: {
            type: 'save_attack',
            action: 'action',
            damage: '3d10',
            damageType: 'Force',
            saveType: 'STR',
            saveDc: 'ability',
            saveAbility: 'CHA',
            shape: 'emanation_30ft',
            range: '30_ft',
            uses: 1,
            recharge: 'long_rest',
            resourceCost: 'sorcery_points',
            restoreCost: 5,
        },
    };
}

describe('executeHandler — Warping Implosion dispatch (CLA-384)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('routes save_attack+sorcery_points+restoreCost to handleWarpingImplosion', async () => {
        const action = makeImplosionAction();
        const result = await executeHandler(action, playerStats, 'test-campaign', null);

        expect(handleWarpingImplosion).toHaveBeenCalledWith(action, playerStats, 'test-campaign', null, undefined);
        expect(handleSaveAttack).not.toHaveBeenCalled();
        expect(result.modalName).toBe('warpingImplosion');
    });

    it('control: unrelated save_attack still dispatches to the generic handler', async () => {
        const action = {
            name: 'Breath Weapon',
            automation: { type: 'save_attack', damage: '2d6', damageType: 'Fire', saveType: 'DEX', shape: 'cone' },
        };
        const result = await executeHandler(action, playerStats, 'test-campaign', null);

        expect(handleSaveAttack).toHaveBeenCalled();
        expect(handleWarpingImplosion).not.toHaveBeenCalled();
        expect(result.payload.name).toBe('GENERIC');
    });
});

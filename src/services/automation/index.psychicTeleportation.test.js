// CLA-320: auto_effect psychic_teleportation had NO dispatch (returned null,
// pool untouched) — executeHandler must route it by effect to its handler.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { executeHandler } from './index.js';
import { handle as handlePsychicTeleportation } from './handlers/class-sorcerer/psychicTeleportationHandler.js';

vi.mock('./handlers/class-sorcerer/psychicTeleportationHandler.js', () => ({
    handle: vi.fn(async () => ({
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Psychic Teleportation',
            description: 'Teleported. Psionic Energy: 8/12.',
        },
    })),
}));

const playerStats = { name: 'AasimarTest', level: 17, _trackedResources: { psionicEnergy: { max: 12 } } };

function makeTeleportAction() {
    return {
        name: 'Psychic Teleportation',
        automation: {
            type: 'auto_effect',
            effect: 'psychic_teleportation',
            trigger: 'psychic_teleportation',
            uses: '1',
            recharge: 'short_rest',
        },
    };
}

describe('executeHandler — psychic_teleportation dispatch (CLA-320)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('routes auto_effect/psychic_teleportation to handlePsychicTeleportation and returns its popup', async () => {
        const action = makeTeleportAction();
        const result = await executeHandler(action, playerStats, 'test-campaign', null);

        expect(handlePsychicTeleportation).toHaveBeenCalledWith(action, playerStats, 'test-campaign', null, undefined);
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Psychic Teleportation',
                description: 'Teleported. Psionic Energy: 8/12.',
            },
        });
    });

    it('control: unrelated auto_effect still dispatches null', async () => {
        const action = {
            name: 'Vex',
            automation: { type: 'auto_effect', trigger: 'miss', effect: 'next_attack_advantage' },
        };
        const result = await executeHandler(action, playerStats, 'test-campaign', null);

        expect(result).toBeNull();
        expect(handlePsychicTeleportation).not.toHaveBeenCalled();
    });
});

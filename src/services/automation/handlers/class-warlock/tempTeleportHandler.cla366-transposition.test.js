// CLA-366 regression: Trickster's Transposition swap was popup-only inert —
// the row must be gated on the Invoke Duplicity create_illusion buff
// (refusal popup + transposition_refused log when absent) and a confirmed
// swap must persist a teleport_swap_with_illusion te mirror + ability_use log
// (CLA-357 telekinetic_movement model).
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, confirmTeleport } from './tempTeleportHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 3),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 13),
    createSaveListener: vi.fn(() => ({ promptId: 'test-id' })),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(async () => ({ target: { name: 'Goblin' } })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn(),
    getEffectDefinition: vi.fn(() => ({ effect: 'teleport_swap_with_illusion' })),
}));

import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { registerTargetEffect, getEffectDefinition } from '../../../combat/conditions/targetEffectDefinitions.js';

const CAMPAIGN_NAME = 'test-campaign';
const PLAYER_NAME = 'War_Cleric';

const makeAction = (auto = {}) => ({
    name: "Trickster's Transposition",
    description: 'Swap places with your illusion.',
    automation: {
        type: 'temp_buff',
        effect: 'teleport_swap_with_illusion',
        action: 'bonus_action',
        distance: '30 ft',
        casting_time: '1 bonus action',
        ...auto,
    },
});

const makePlayerStats = (overrides = {}) => ({
    name: PLAYER_NAME,
    level: 6,
    proficiency: 3,
    abilities: [{ name: 'Wisdom', bonus: 3 }],
    automation: { passives: [] },
    ...overrides,
});

const setupBuffs = (buffs) => {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === PLAYER_NAME && key === 'activeBuffs') return buffs;
        return null;
    });
};

describe('CLA-366 Trickster\'s Transposition', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        getEffectDefinition.mockReturnValue({ effect: 'teleport_swap_with_illusion' });
    });

    describe('handle — illusion-active gate', () => {
        it('refuses with popup + transposition_refused log when no create_illusion buff is active', async () => {
            setupBuffs([]);
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('not active');
            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN_NAME,
                expect.objectContaining({
                    type: 'automation',
                    characterName: PLAYER_NAME,
                    automationType: 'transposition_refused',
                    name: "Trickster's Transposition",
                }),
            );
        });

        it('refuses when activeBuffs is null (no illusion entity to swap with)', async () => {
            getRuntimeValue.mockReturnValue(null);
            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'test-map');

            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN_NAME,
                expect.objectContaining({ automationType: 'transposition_refused' }),
            );
        });

        it('opens the teleport swap modal while the create_illusion buff is active', async () => {
            setupBuffs([{ name: 'Invoke Duplicity', effect: 'create_illusion', duration: '1_minute' }]);
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'test-map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
            expect(result.payload.action).toBe(action);
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('does not gate other teleport effects (shadow_step)', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeAction({ effect: 'shadow_step_teleport', distance: undefined });

            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'test-map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
        });
    });

    describe('confirmTeleport — swap persist + log', () => {
        it('registers a teleport_swap_with_illusion te mirror on the caster', async () => {
            const action = makeAction();
            await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(getEffectDefinition).toHaveBeenCalledWith('teleport_swap_with_illusion');
            expect(registerTargetEffect).toHaveBeenCalledWith(
                CAMPAIGN_NAME,
                PLAYER_NAME,
                'teleport_swap_with_illusion',
                "Trickster's Transposition",
                expect.objectContaining({
                    value: 30,
                    swappedDistanceFt: 30,
                    duration: 'instant',
                }),
            );
        });

        it('logs ability_use with event details', async () => {
            const action = makeAction();
            await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN_NAME,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: PLAYER_NAME,
                    abilityName: "Trickster's Transposition",
                    description: expect.stringContaining('swapping places with their Invoke Duplicity illusion'),
                }),
            );
        });

        it('keeps the swap popup text and resolves the raw distance token to numeric feet', async () => {
            const action = makeAction({ distance: '30_ft' });
            const result = await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Swapped places with your illusion');
            expect(result.payload.description).toContain('30 feet');
            expect(result.payload.description).not.toContain('30_ft');
        });

        it('describes the illusion-move trigger for the move row (moveIllusion)', async () => {
            const action = makeAction({ moveIllusion: true });
            const result = await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(result.payload.description).toContain('Moved your Invoke Duplicity illusion');
            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN_NAME,
                expect.objectContaining({
                    type: 'ability_use',
                    description: expect.stringContaining('move their Invoke Duplicity illusion up to 30 feet and swap places'),
                }),
            );
            expect(registerTargetEffect).toHaveBeenCalledWith(
                CAMPAIGN_NAME,
                PLAYER_NAME,
                'teleport_swap_with_illusion',
                "Trickster's Transposition",
                expect.objectContaining({ movedIllusion: true }),
            );
        });
    });
});

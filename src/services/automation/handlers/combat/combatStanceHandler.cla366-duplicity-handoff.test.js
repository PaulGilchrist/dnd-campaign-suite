// CLA-366 regression: at Invoke Duplicity creation the creation-time auto
// swap offer handed TeleportModal a FLAT automation object, so
// `action?.automation` resolved to {} and the generic Rage teleport chooser
// rendered. The handoff must re-wrap as {name, automation}.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './combatStanceHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../buffs/tempHpBuffHandler.js', () => ({
    grantTempHpOnRage: vi.fn(),
    handle: vi.fn(),
    confirmVitalityOfTheTree: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
    clearExtendedFlag: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'War_Cleric',
        level: 6,
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Invoke Duplicity',
        automation: {
            type: 'combat_stance',
            effect: 'create_illusion',
            duration: '1_minute',
            resourceCost: 'channel_divinity',
            ...automation,
        },
    };
}

function setupRuntimeMocks(mocks) {
    runtimeState.getRuntimeValue.mockImplementation((player, prop, camp) => {
        const key = `${player}:${prop}:${camp}`;
        return key in mocks ? mocks[key] : null;
    });
}

describe('CLA-366 create_illusion teleport handoff wraps flat specialActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('wraps the flat teleport_swap_with_illusion special action for TeleportModal', async () => {
        setupRuntimeMocks({
            'War_Cleric:activeBuffs:TestCampaign': [],
            'War_Cleric:channelDivinityCharges:TestCampaign': 2,
        });

        const flatSwap = {
            name: "Trickster's Transposition",
            type: 'temp_buff',
            effect: 'teleport_swap_with_illusion',
            distance: '30 ft',
            action: 'bonus_action',
            duration: 'while_illusion_active',
        };

        const result = await handle(
            makeAction(),
            makePlayerStats({ automation: { specialActions: [flatSwap], passives: [] } }),
            campaignName,
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('teleport');
        expect(result.payload.triggeredByDuplicity).toBe(true);
        // TeleportModal reads action?.automation — the flat object alone would
        // resolve to {} and render the generic Rage chooser (the reported bug).
        expect(result.payload.action.automation).toBe(flatSwap);
        expect(result.payload.action.automation.effect).toBe('teleport_swap_with_illusion');
        expect(result.payload.action.name).toBe("Trickster's Transposition");
        expect(result.payload.action.distance).toBeUndefined();
    });
});

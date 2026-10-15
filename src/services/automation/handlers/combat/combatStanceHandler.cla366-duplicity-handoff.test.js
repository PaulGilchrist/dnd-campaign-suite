// @maintained-by-ai
// CLA-366 regression: at Invoke Duplicity creation the creation-time auto
// swap offer handed TeleportModal a FLAT automation object, so
// `action?.automation` resolved to {} and the generic Rage teleport chooser
// rendered. The handoff must re-wrap as {name, automation}.
//
// combatStanceHandler sextet — lane: CLA-366 duplicity teleport handoff.
// Owns resolveIllusionFollowUp() on the create_illusion activation path:
//  - teleport_swap_with_illusion re-wrap handoff (strict {name, automation}
//    wrapper shape, triggeredByDuplicity flag);
//  - branch precedence: Improved Duplicity (invokeDuplicity modal) wins over
//    the swap handoff when both exist;
//  - near-miss guard: non-matching specialActions (e.g. teleport_on_rage)
//    must not misfire the duplicity handoff.
// The plain-popup negative branch (empty specialActions) and buff/resource
// shapes are owned by the activation lane; modal/refusal paths by main.
//
// Live production path: public/data/classes.json "Channel Divinity: Invoke
// Duplicity" (combat_stance/create_illusion, channel_divinity) plus flat
// specialActions from public/data/2024/classes.json "Trickster's
// Transposition". Deterministic: runtime/logService/combatData mocked.
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

// Mirrors the FLAT automation.specialActions entry produced from
// public/data/2024/classes.json Trickster's Transposition.
function flatTransposition(overrides = {}) {
    return {
        name: "Trickster's Transposition",
        type: 'temp_buff',
        effect: 'teleport_swap_with_illusion',
        distance: '30 ft',
        action: 'bonus_action',
        duration: 'while_illusion_active',
        ...overrides,
    };
}

function setupRuntimeMocks(mocks) {
    runtimeState.getRuntimeValue.mockImplementation((player, prop, camp) => {
        const key = `${player}:${prop}:${camp}`;
        return key in mocks ? mocks[key] : null;
    });
}

const baseMocks = {
    'War_Cleric:activeBuffs:TestCampaign': [],
    'War_Cleric:channelDivinityCharges:TestCampaign': 2,
};

describe('CLA-366 create_illusion teleport handoff wraps flat specialActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('wraps the flat teleport_swap_with_illusion special action for TeleportModal', async () => {
        setupRuntimeMocks(baseMocks);

        const flatSwap = flatTransposition();
        const playerStats = makePlayerStats({
            automation: { specialActions: [flatSwap], passives: [] },
        });

        const result = await handle(makeAction(), playerStats, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('teleport');
        expect(result.payload.triggeredByDuplicity).toBe(true);
        expect(result.payload.playerStats).toBe(playerStats);
        expect(result.payload.campaignName).toBe(campaignName);
        // TeleportModal reads action?.automation — the flat object alone would
        // resolve to {} and render the generic Rage chooser (the reported bug).
        // The wrapper is exactly {name, automation}: flat fields such as
        // distance must NOT be hoisted onto it.
        expect(Object.keys(result.payload.action).sort()).toEqual(['automation', 'name']);
        expect(result.payload.action.automation).toBe(flatSwap);
        expect(result.payload.action.automation.effect).toBe('teleport_swap_with_illusion');
        expect(result.payload.action.name).toBe("Trickster's Transposition");
    });

    it('gives the invokeDuplicity modal precedence over the swap handoff when Improved Duplicity is present', async () => {
        setupRuntimeMocks(baseMocks);

        const flatSwap = flatTransposition();
        const action = makeAction();
        const playerStats = makePlayerStats({
            automation: {
                specialActions: [flatSwap],
                passives: [{ name: 'Enhanced Distraction', effect: 'enhanced_distraction_and_healing' }],
            },
        });

        const result = await handle(action, playerStats, campaignName);

        // resolveIllusionFollowUp checks isImprovedDuplicity BEFORE searching
        // for teleport_swap_with_illusion: the payload carries the full
        // Invoke Duplicity action, not the wrapped swap special action.
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('invokeDuplicity');
        expect(result.payload.action).toBe(action);
        expect(result.payload.triggeredByDuplicity).toBeUndefined();
    });

    it('does not hand off teleport on a near-miss special action during create_illusion activation', async () => {
        setupRuntimeMocks(baseMocks);

        const playerStats = makePlayerStats({
            automation: {
                specialActions: [{ name: 'Instinctive Pounce', effect: 'rage_bonus_movement' }],
                passives: [],
            },
        });

        const result = await handle(makeAction(), playerStats, campaignName);

        // teleport_on_rage-style entries are consumed by the Rage path only;
        // on the duplicity path a non-matching effect falls through to popup.
        expect(result.type).toBe('popup');
        expect(result.payload.name).toBe('Invoke Duplicity');
        expect(result.payload.triggeredByDuplicity).toBeUndefined();
    });
});

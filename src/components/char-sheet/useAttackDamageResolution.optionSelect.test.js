// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

// Direct imports of the hook plus transitive-graph pins (steps/index.js is
// loaded unmocked; these stubs keep its subtree deterministic and side-effect-free).
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    collectWeaponMastery: vi.fn(),
    evaluateAutoExpression: vi.fn(),
    hasTwoWeaponFighting: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    executeAttackRiderManeuver: vi.fn(),
    applyManeuveringAllyGrant: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const CHAR = 'TestFighter';
const CAMPAIGN = 'test-campaign';
const TARGET = 'Goblin';

// Fresh deps per mount — nothing shared between tests.
function Harness(overrides = {}) {
    const deps = {
        playerStats: { name: CHAR },
        campaignName: CAMPAIGN,
        mapName: null,
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollDamage: vi.fn(),
        setModalState: vi.fn(),
        setPendingDamage: vi.fn(),
        resumeRef: { current: null },
        ...overrides,
    };
    return { api: useAttackDamageResolution(deps), deps };
}

// Pipeline paused at attackRiderManeuvers with damage stashed (the #306
// pendingOptions state this consumer lane is supposed to close).
function stashAtManeuvers() {
    const resume = vi.fn();
    const ctx = { targetName: TARGET };
    const resumeRef = { current: { _pausedStep: 'attackRiderManeuvers', pipelineStash: { pipeline: { resume }, ctx } } };
    return { resume, resumeRef };
}

const brutalStrike = (...options) => ({
    name: 'Brutal Strike',
    automation: { options },
});

describe('useAttackDamageResolution - handleAttackRiderOptionSelect', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('closes the options modal, latches brutal-strike flags, pops automation_info — damage stays stashed', async () => {
        const { resume, resumeRef } = stashAtManeuvers();
        const { api, deps } = Harness({ resumeRef });

        await api.handleAttackRiderOptionSelect('Extra Damage', {
            maneuver: brutalStrike({ name: 'Extra Damage', effect: 'extra_damage' }),
            targetName: TARGET,
            description: 'Test description',
        });

        expect(deps.setModalState).toHaveBeenCalledTimes(1);
        expect(deps.setModalState).toHaveBeenCalledWith({ attackRiderOptionsModal: null });
        // The loop #306 left stashed closes via the runtime latch, NOT resume:
        expect(resume).not.toHaveBeenCalled();
        expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, CHAR, '_brutalStrikeActive', true, CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, CHAR, '_brutalStrikeEffects', ['Extra Damage'], CAMPAIGN);
        expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
        expect(deps.setPopupHtml).toHaveBeenCalledWith({
            type: 'automation_info',
            name: 'Brutal Strike',
            description: 'Test description Selected: Extra Damage.',
        });
    });

    it.each([
        {
            branch: 'push_15ft writes instant push and appends push text',
            option: { name: 'Knock Back', effect: 'push_15ft' },
            expectedEffect: { target: TARGET, source: CHAR, option: 'Knock Back', effect: 'push', value: 15, duration: 'instant' },
            expectedDescription: 'Test description Goblin pushed 15 feet. Selected: Knock Back.',
        },
        {
            branch: 'speed_reduction passes explicit option.value through byte-exact',
            option: { name: 'Slow', effect: 'speed_reduction', value: '10_ft_until_end_of_turn' },
            expectedEffect: { target: TARGET, source: CHAR, option: 'Slow', effect: 'speed_reduction', value: '10_ft_until_end_of_turn', duration: 'until_start_of_next_turn' },
            // Honest pin: log text hardcodes "15 feet" even for non-15 values.
            expectedDescription: "Test description Goblin's speed reduced by 15 feet. Selected: Slow.",
        },
        {
            branch: 'speed_reduction defaults value when option.value is missing',
            option: { name: 'Slow', effect: 'speed_reduction' },
            expectedEffect: { target: TARGET, source: CHAR, option: 'Slow', effect: 'speed_reduction', value: '15_ft_until_start_of_next_turn', duration: 'until_start_of_next_turn' },
            expectedDescription: "Test description Goblin's speed reduced by 15 feet. Selected: Slow.",
        },
    ])('immediate effect $branch', async ({ option, expectedEffect, expectedDescription }) => {
        const preExisting = { target: 'Orc', source: 'SomeoneElse', effect: 'sanctuary' };
        getRuntimeValue.mockImplementation((key, prop) => (prop === 'targetEffects' ? [preExisting] : undefined));
        const { api, deps } = Harness();

        await api.handleAttackRiderOptionSelect(option.name, {
            maneuver: brutalStrike(option),
            targetName: TARGET,
            description: 'Test description',
        });

        // Byte-exact round-trip: stored effects preserved, new effect appended last.
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [preExisting, expectedEffect], CAMPAIGN);
        expect(deps.setPopupHtml).toHaveBeenCalledWith({
            type: 'automation_info',
            name: 'Brutal Strike',
            description: expectedDescription,
        });
    });

    it.each([
        {
            branch: 'option not found in automation.options',
            optionName: 'Nonexistent Option',
            option: null,
            targetName: TARGET,
        },
        {
            branch: 'push_15ft with null targetName',
            optionName: 'Knock Back',
            option: { name: 'Knock Back', effect: 'push_15ft' },
            targetName: null,
        },
        {
            branch: 'speed_reduction with null targetName',
            optionName: 'Slow',
            option: { name: 'Slow', effect: 'speed_reduction' },
            targetName: null,
        },
    ])('effect-free path $branch: flags latch, popup shows base description, zero targetEffects writes', async ({ optionName, option, targetName }) => {
        const { api, deps } = Harness();

        await api.handleAttackRiderOptionSelect(optionName, {
            maneuver: brutalStrike(...(option ? [option] : [])),
            targetName,
            description: 'Test description',
        });

        // Only the two flag latches hit the runtime store — no targetEffects at all.
        expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, CHAR, '_brutalStrikeActive', true, CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, CHAR, '_brutalStrikeEffects', [optionName], CAMPAIGN);
        expect(deps.setPopupHtml).toHaveBeenCalledWith({
            type: 'automation_info',
            name: 'Brutal Strike',
            description: `Test description Selected: ${optionName}.`,
        });
    });

    it.each([
        { branch: 'null modalPayload', payload: null, mutatesBeforeThrow: false },
        {
            branch: 'payload without maneuver',
            payload: { targetName: TARGET, description: 'Test description' },
            // Honest pin: modal close + flag latch execute BEFORE the
            // maneuver.automation access throws (validation-after-mutation).
            mutatesBeforeThrow: true,
        },
    ])('rejects on invalid payload ($branch)', async ({ payload, mutatesBeforeThrow }) => {
        const { resume, resumeRef } = stashAtManeuvers();
        const { api, deps } = Harness({ resumeRef });

        await expect(api.handleAttackRiderOptionSelect('Some Option', payload))
            .rejects.toThrow(TypeError);

        expect(resume).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        if (mutatesBeforeThrow) {
            expect(deps.setModalState).toHaveBeenCalledWith({ attackRiderOptionsModal: null });
            expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        } else {
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        }
    });
});

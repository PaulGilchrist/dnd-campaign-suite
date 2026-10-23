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

// fix#10r spread: un-mocked applyDamage exports stay real for the unmocked
// steps/index.js transitive graph (partial-mock Proxy holes hazard).
vi.mock('../../services/rules/combat/applyDamage.js', async (importOriginal) => ({
    ...(await importOriginal()),
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

// fix#10r spread: automation/index (real, via applyDamage) reads `handle`
// from this module — partial-mock Proxy hole eval-throw (CalmEmotions precedent).
vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', async (importOriginal) => ({
    ...(await importOriginal()),
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
            // fix#167: log interpolates the applied distance (was a hardcoded
            // "15 feet" lie while the store carried the option's own value).
            expectedDescription: "Test description Goblin's speed reduced by 10 feet. Selected: Slow.",
        },
        {
            branch: 'speed_reduction numeric option.value (feats.json Hamstring disk shape) logs the number it writes',
            option: { name: 'Hamstring', effect: 'speed_reduction', value: 10 },
            expectedEffect: { target: TARGET, source: CHAR, option: 'Hamstring', effect: 'speed_reduction', value: 10, duration: 'until_start_of_next_turn' },
            expectedDescription: "Test description Goblin's speed reduced by 10 feet. Selected: Hamstring.",
        },
        {
            branch: 'speed_reduction defaults value when option.value is missing',
            option: { name: 'Slow', effect: 'speed_reduction' },
            expectedEffect: { target: TARGET, source: CHAR, option: 'Slow', effect: 'speed_reduction', value: '15_ft_until_start_of_next_turn', duration: 'until_start_of_next_turn' },
            expectedDescription: "Test description Goblin's speed reduced by 15 feet. Selected: Slow.",
        },
        {
            branch: 'speed_reduction value with no parseable distance logs general wording (no fabricated number)',
            option: { name: 'Slow', effect: 'speed_reduction', value: 'half_speed' },
            expectedEffect: { target: TARGET, source: CHAR, option: 'Slow', effect: 'speed_reduction', value: 'half_speed', duration: 'until_start_of_next_turn' },
            expectedDescription: "Test description Goblin's speed reduced. Selected: Slow.",
        },
    ])('immediate effect $branch', async ({ option, expectedEffect, expectedDescription }) => {
        const preExisting = { target: 'Orc', source: 'SomeoneElse', effect: 'sanctuary' };
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
        // fix#158 coupling idiom: whenever the stored value carries a number,
        // the log MUST report that same number — write site is single source.
        const storedFeet = String(expectedEffect.value ?? '').match(/(\d+)/)?.[1];
        if (storedFeet) {
            expect(expectedDescription).toContain(`${storedFeet} feet`);
            expect(errorSpy).not.toHaveBeenCalled();
        } else if (expectedEffect.effect === 'speed_reduction') {
            expect(expectedDescription).not.toMatch(/\d+ feet/);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('no numeric distance'));
        }
        errorSpy.mockRestore();
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

        // Modal close pins too: :579 close is unconditional post-validation, so
        // the option-not-found branch must close exactly like the found-option
        // branch above (migrated from the retired skipManeuver.test.js dup block —
        // without this pin, a mutant gating the close inside `if (option)` survives).
        expect(deps.setModalState).toHaveBeenCalledTimes(1);
        expect(deps.setModalState).toHaveBeenCalledWith({ attackRiderOptionsModal: null });
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
        { branch: 'null modalPayload', payload: null },
        {
            branch: 'payload without maneuver',
            payload: { targetName: TARGET, description: 'Test description' },
        },
        {
            branch: 'maneuver without automation.options',
            payload: { maneuver: { name: 'Brutal Strike' }, targetName: TARGET, description: 'Test description' },
        },
    ])('rejects on invalid payload ($branch) with ZERO mutation — latch never minted, modal stays open', async ({ payload }) => {
        const { resume, resumeRef } = stashAtManeuvers();
        const { api, deps } = Harness({ resumeRef });
        // Faithful store, #1517-null-canon: real Map-backed runtime state —
        // reads reflect exactly what writes minted; unwritten keys stay dark
        // (null on read, absent from the ledger).
        const store = new Map();
        getRuntimeValue.mockImplementation((key, prop) => store.get(`${key}:${prop}`) ?? null);
        setRuntimeValue.mockImplementation((key, prop, value) => { store.set(`${key}:${prop}`, value); });

        // Rejection consumed without escape — same TypeError shape as the
        // destructure at :555 always had, now raised by the hoisted lookup.
        await expect(api.handleAttackRiderOptionSelect('Some Option', payload))
            .rejects.toThrow(TypeError);

        // Exact runtime-state negative: the brutal-strike latch was NEVER
        // written (fix: validation precedes close+latch — stuck-latch gone).
        expect(store.has(`${CHAR}:_brutalStrikeActive`)).toBe(false);
        expect(store.has(`${CHAR}:_brutalStrikeEffects`)).toBe(false);
        expect([...store.keys()]).toEqual([]);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        // Modal state unchanged: zero setModalState writes — the options
        // modal stays open on invalid input (no close-before-reject).
        expect(deps.setModalState).not.toHaveBeenCalled();
        expect(resume).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).not.toHaveBeenCalled();
    });
});

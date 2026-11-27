// @maintained-by-ai 2026-11-26
// Deterministic: mocks the runtime-state, combat-context, and log seams at
// module boundaries; vi.resetModules per test isolates the un-removable
// window listener that setupVowTransferListener registers (SOURCE NOTE: the
// source adds a listener per activation with NO removal handle — the listener
// lane here pins the subscribe contract, one write-set per dispatch, and the
// persisted re-fire; a teardown fix must re-seam these censuses). Listener
// assertions use full-shape ordered mock.calls censuses so any double-dispatch
// or extra write fails. Also pins the level/maxCharges/HP field-shape
// fallbacks shared by handle() and applyTargetChoice(). Sibling lanes:
// vowOfEnmityHandler.test.js owns handle() entry;
// vowOfEnmityHandler.applyTargetChoice.test.js owns applyTargetChoice.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

const campaignName = 'test-campaign';

const vowBuff = { name: 'Vow of Enmity', effect: 'vow_of_enmity', duration: '1_minute', source: 'Paladin1' };
const blessBuff = { name: 'Bless', effect: 'bless', source: 'Cleric1' };
const markedBuff = { name: "Hunter's Mark", effect: 'hunters_mark', source: 'Ranger1' };

// The exact buff object activateVowOfEnmity() appends to the target store.
const activationBuff = {
    name: 'Vow of Enmity',
    effect: 'vow_of_enmity',
    duration: '1_minute',
    source: 'Paladin1',
};

// Imported fresh per test (see beforeEach) so spies attach to the same
// module instances the reloaded handler resolves.
let handle;
let applyTargetChoice;
let addEntry;
let runtimeState;
let damageUtils;
let state;

function makePlayerStats(overrides = {}) {
    return {
        name: 'Paladin1',
        level: 7,
        class: {
            class_levels: [
                { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 },
                { level: 5 }, { level: 6 }, { level: 7 },
            ],
        },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Vow of Enmity',
        automation: { type: 'vow_of_enmity', ...overrides.automation },
        ...(overrides.name ? { name: overrides.name } : {}),
    };
}

// Fresh router state + spies. Per-name keyed entries win over plain-key
// fallbacks so attacker and target can hold different activeBuffs.
function setupRuntime(initial = {}) {
    state = { ...initial };
    vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((targetName, key) => {
        const k = `${targetName}:${key}:${campaignName}`;
        if (k in state) return state[k];
        return key in state ? state[key] : null;
    });
    vi.spyOn(runtimeState, 'setRuntimeValue').mockImplementation(async (targetName, key, value) => {
        state[`${targetName}:${key}:${campaignName}`] = value;
        state[key] = value;
    });
    return state;
}

function mockCombat(context, target) {
    vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue(context);
    if (target !== undefined) {
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue(target);
    }
}

// Fire the event the combat summary dispatches when HP changes, then let the
// async listener settle.
async function dispatchSummaryUpdate() {
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    await new Promise(resolve => setTimeout(resolve, 50));
}

beforeEach(async () => {
    // setupVowTransferListener adds a window listener with no removal handle;
    // reload the handler module per test so listeners never leak across tests.
    vi.resetModules();
    vi.restoreAllMocks();
    ({ handle, applyTargetChoice } = await import('./vowOfEnmityHandler.js'));
    runtimeState = await import('../../../../hooks/runtime/useRuntimeState.js');
    damageUtils = await import('../../../rules/combat/damageUtils.js');
    ({ addEntry } = await import('../../../ui/logService.js'));
    addEntry.mockResolvedValue({});
    addEntry.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── Fallbacks shared by handle() and applyTargetChoice() ───

describe('vowOfEnmityHandler fallbacks', () => {

    it('handle: level undefined with empty class_levels falls back to level 1 and default maxCharges 2', async () => {
        setupRuntime(); // no stored charges → currentCharges = maxCharges = 2
        mockCombat({ creatures: [{ name: 'Goblin' }] }, { name: 'Goblin' });

        const ps = { name: 'Paladin1', level: undefined, class: { class_levels: [] } };
        const result = await handle(makeAction(), ps, campaignName);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Vow of Enmity',
                automationType: 'vow_of_enmity',
                description: 'Vow of Enmity activated against Goblin. (1 Channel Divinity charge remaining).',
                automation: { type: 'vow_of_enmity' },
            },
        });
        // Full activation write census: default-2 consumption plus every
        // target/cost/buff write in source order.
        expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
            ['Paladin1', 'channelDivinityCharges', 1, campaignName],
            ['Paladin1', 'vowOfEnmityTarget', 'Goblin', campaignName],
            ['Paladin1', 'vowOfEnmityCostPaid', true, campaignName],
            ['Goblin', 'activeBuffs', [activationBuff], campaignName],
        ]);
    });

    it('applyTargetChoice: stored charges null → maxCharges from channel_divinity', async () => {
        setupRuntime();

        const ps = makePlayerStats({
            level: 3,
            class: { class_levels: [undefined, undefined, { channel_divinity: 3 }] },
        });
        const result = await applyTargetChoice(makeAction(), ps, campaignName, 'Orc');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Vow of Enmity activated against Orc. (2 Channel Divinity charges remaining).',
        );
        expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
            ['Paladin1', 'channelDivinityCharges', 2, campaignName],
            ['Paladin1', 'vowOfEnmityTarget', 'Orc', campaignName],
            ['Paladin1', 'vowOfEnmityCostPaid', true, campaignName],
            ['Orc', 'activeBuffs', [activationBuff], campaignName],
        ]);
    });

    it('free reactivation for every defeated-HP shape with ZERO charge writes', async () => {
        // Branches of `currentHp ?? hit_points?.current ?? 0` in
        // resolveVowReactivation plus the same-target-name description arm.
        setupRuntime({ vowOfEnmityTarget: 'Goblin', vowOfEnmityCostPaid: true, activeBuffs: [] });
        mockCombat(
            { creatures: [{ name: 'Goblin', hit_points: { current: 0 } }, { name: 'Orc', currentHp: 10 }] },
            { name: 'Orc' },
        );
        const viaHitPoints = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(viaHitPoints.payload.description).toBe(
            'Vow of Enmity reactivated against Orc. Transferred from Goblin. Previous target defeated — no Channel Divinity cost.',
        );

        setupRuntime({ vowOfEnmityTarget: 'Goblin', vowOfEnmityCostPaid: true, activeBuffs: [] });
        mockCombat(
            { creatures: [{ name: 'Goblin' }, { name: 'Orc', currentHp: 10 }] },
            { name: 'Orc' },
        );
        const viaFallback = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(viaFallback.payload.description).toBe(
            'Vow of Enmity reactivated against Orc. Transferred from Goblin. Previous target defeated — no Channel Divinity cost.',
        );

        // Same target name: no "Transferred" clause at all.
        setupRuntime({ vowOfEnmityTarget: 'Goblin', vowOfEnmityCostPaid: true, activeBuffs: [] });
        mockCombat({ creatures: [{ name: 'Goblin', currentHp: 0 }] }, { name: 'Goblin' });
        const sameTarget = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(sameTarget.payload.description).toBe(
            'Vow of Enmity reactivated against Goblin. Previous target defeated — no Channel Divinity cost.',
        );

        // Zero-write census across all three free reactivations.
        expect(runtimeState.setRuntimeValue.mock.calls.every(c => c[1] !== 'channelDivinityCharges')).toBe(true);
    });

    it('cost message: plural, singular, and depleted charge counts', async () => {
        setupRuntime({ channelDivinityCharges: 3, activeBuffs: [] });
        mockCombat({ creatures: [{ name: 'Goblin' }] }, { name: 'Goblin' });
        const plural = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(plural.payload.description).toBe(
            'Vow of Enmity activated against Goblin. (2 Channel Divinity charges remaining).',
        );

        setupRuntime({ channelDivinityCharges: 2, activeBuffs: [] });
        const singular = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(singular.payload.description).toBe(
            'Vow of Enmity activated against Goblin. (1 Channel Divinity charge remaining).',
        );

        setupRuntime({ channelDivinityCharges: 1, activeBuffs: [] });
        const depleted = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(depleted.payload.description).toBe(
            'Vow of Enmity activated against Goblin. (Channel Divinity depleted).',
        );
    });

    it('logs error to console when addEntry rejects (activation still succeeds)', async () => {
        setupRuntime({ channelDivinityCharges: 2, activeBuffs: [] });
        mockCombat({ creatures: [{ name: 'Goblin' }] }, { name: 'Goblin' });
        addEntry.mockRejectedValue(new Error('log failed'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith(
            '[vowOfEnmity] Error logging:',
            expect.any(Error),
        );
    });
});

// ─── setupVowTransferListener ───

describe('vowOfEnmityHandler setupVowTransferListener', () => {

    // Activate a vow against Goblin so the listener is registered, then wipe
    // the activation writes so post-dispatch census assertions see only the
    // listener's writes.
    async function registerVow(initial = {}) {
        const state = setupRuntime({ channelDivinityCharges: 1, ...initial });
        mockCombat({ creatures: [{ name: 'Goblin', currentHp: 5 }] }, { name: 'Goblin' });
        await handle(makeAction(), makePlayerStats(), campaignName);
        runtimeState.setRuntimeValue.mockClear();
        // fix#354(b): expose the store so arms can corrupt it post-activation.
        return state;
    }

    it('activation subscribes exactly one combat-summary-updated window listener', async () => {
        // Subscribe contract: registerVow-style activation adds one listener.
        // SOURCE NOTE: there is no removal lane — repeat activations stack
        // additional listeners (reported defect; not pinned as desired behavior).
        setupRuntime({ channelDivinityCharges: 2, activeBuffs: [] });
        mockCombat({ creatures: [{ name: 'Goblin', currentHp: 5 }] }, { name: 'Goblin' });
        const addSpy = vi.spyOn(window, 'addEventListener');

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(addSpy).toHaveBeenCalledTimes(1);
        expect(addSpy).toHaveBeenCalledWith('combat-summary-updated', expect.any(Function));
    });

    it('clears vow and filters vow_of_enmity from attacker and target buffs, preserving unrelated buffs', async () => {
        // fix#354(b) sites 3+4 valid-arms: validate-first keeps filter+write
        // VERBATIM. Full ordered census — one write-set per dispatch.
        await registerVow({
            'Paladin1:activeBuffs:test-campaign': [vowBuff, blessBuff],
            'Goblin:activeBuffs:test-campaign': [markedBuff],
        });

        mockCombat({ creatures: [{ name: 'Goblin', currentHp: 0 }] });
        await dispatchSummaryUpdate();

        expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
            ['Paladin1', 'vowOfEnmityTarget', null, campaignName],
            ['Paladin1', 'vowOfEnmityCostPaid', null, campaignName],
            ['Paladin1', 'activeBuffs', [blessBuff], campaignName],
            ['Goblin', 'activeBuffs', [markedBuff], campaignName],
        ]);
    });

    it('listener persists after clearing: re-fires once per dispatch for hit_points.current then missing-HP shapes', async () => {
        // Pins the listener's `currentHp ?? hit_points?.current ?? 0` fallback
        // chain and its no-teardown persistence: with no removal handle, each
        // later dispatch re-writes exactly one clear set (never two).
        await registerVow({ 'Paladin1:activeBuffs:test-campaign': [vowBuff] });
        const expectedWrites = [
            ['Paladin1', 'vowOfEnmityTarget', null, campaignName],
            ['Paladin1', 'vowOfEnmityCostPaid', null, campaignName],
            ['Paladin1', 'activeBuffs', [], campaignName],
            ['Goblin', 'activeBuffs', [], campaignName],
        ];

        mockCombat({ creatures: [{ name: 'Goblin', hit_points: { current: 0 } }] });
        await dispatchSummaryUpdate();
        expect(runtimeState.setRuntimeValue.mock.calls).toEqual(expectedWrites);

        runtimeState.setRuntimeValue.mockClear();
        mockCombat({ creatures: [{ name: 'Goblin' }] });
        await dispatchSummaryUpdate();
        expect(runtimeState.setRuntimeValue.mock.calls).toEqual(expectedWrites);
    });

    it('FLIPPED #1348 (fix#354(b) sites 3+4/4): missing activeBuffs stores are LOUD-refused with ZERO writes — no more tolerant-clobber []', async () => {
        // Pre-fix pinned quirk: the two listener legs coerced invalid stores
        // (`Array.isArray(x) ? x : []` leg 1, `|| []` leg 2) and WROTE [] over
        // them — clobbering concurrent writes and churning no-ops (fix#170
        // census, fix#337S stamp ledger :1817). Validate-first idiom per
        // invisibilityService.js:20-35 (fix#349(a)) + fix#352: invalid store ->
        // console.error naming the data defect, store untouched.
        // Stores are corrupted AFTER registerVow: handle()'s activation leg
        // re-stamps the target's activeBuffs, pre-corruption fixtures die.
        const state = await registerVow();
        state['Paladin1:activeBuffs:test-campaign'] = null;
        state['Goblin:activeBuffs:test-campaign'] = null;

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockCombat({ creatures: [{ name: 'Goblin', currentHp: 0 }] });
        await dispatchSummaryUpdate();

        expect(consoleSpy).toHaveBeenCalledTimes(2);
        expect(consoleSpy).toHaveBeenCalledWith(
            '[vowOfEnmity] Refusing vow_of_enmity activeBuffs rewrite — stored activeBuffs is not an array:',
            'Paladin1', null,
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            '[vowOfEnmity] Refusing vow_of_enmity activeBuffs rewrite — stored activeBuffs is not an array:',
            'Goblin', null,
        );
        // Full census: only the vow-completes-on-death latch clears land; both
        // activeBuffs legs wrote nothing.
        expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
            ['Paladin1', 'vowOfEnmityTarget', null, campaignName],
            ['Paladin1', 'vowOfEnmityCostPaid', null, campaignName],
        ]);
    });

    it('non-array truthy attacker store never blocks the valid target clear (per-leg independent guards, fix#354(b))', async () => {
        await registerVow({
            'Paladin1:activeBuffs:test-campaign': 'corrupt',
            'Goblin:activeBuffs:test-campaign': [vowBuff, markedBuff],
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockCombat({ creatures: [{ name: 'Goblin', currentHp: 0 }] });
        await dispatchSummaryUpdate();

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith(
            '[vowOfEnmity] Refusing vow_of_enmity activeBuffs rewrite — stored activeBuffs is not an array:',
            'Paladin1', 'corrupt',
        );
        // Full census: refused attacker leg absent, valid leg rewrites verbatim
        // (vow markers stripped, foreign buff kept) in source order.
        expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
            ['Paladin1', 'vowOfEnmityTarget', null, campaignName],
            ['Paladin1', 'vowOfEnmityCostPaid', null, campaignName],
            ['Goblin', 'activeBuffs', [markedBuff], campaignName],
        ]);
    });

    it('does nothing when combat context is null', async () => {
        await registerVow();

        mockCombat(null);
        await dispatchSummaryUpdate();

        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does nothing while target is alive or absent from combat', async () => {
        await registerVow();

        mockCombat({ creatures: [{ name: 'Orc', currentHp: 10 }] });
        await dispatchSummaryUpdate();

        mockCombat({ creatures: [{ name: 'Goblin', currentHp: 3 }] });
        await dispatchSummaryUpdate();

        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
});

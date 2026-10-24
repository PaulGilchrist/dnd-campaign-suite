// @maintained-by-ai
// Deterministic: mocks the runtime-state, combat-context, and log seams at
// module boundaries; vi.resetModules per test isolates the un-removable
// window listener that setupVowTransferListener registers. Pins the stable
// listener contract (vowOfEnmityTarget/vowOfEnmityCostPaid/activeBuffs clears
// consumed by restRules, useInitiativeEffects, ConditionEffectBadges) plus the
// level/maxCharges/HP field-shape fallbacks shared by handle and
// applyTargetChoice. Sibling lanes: vowOfEnmityHandler.test.js owns handle()
// entry; vowOfEnmityHandler.applyTargetChoice.test.js owns applyTargetChoice.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

const campaignName = 'test-campaign';

const vowBuff = { name: 'Vow of Enmity', effect: 'vow_of_enmity', duration: '1_minute', source: 'Paladin1' };
const blessBuff = { name: 'Bless', effect: 'bless', source: 'Cleric1' };
const markedBuff = { name: "Hunter's Mark", effect: 'hunters_mark', source: 'Ranger1' };

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
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── Fallbacks shared by handle() and applyTargetChoice() ───

describe('vowOfEnmityHandler fallbacks', () => {

    it('handle: level undefined with empty class_levels falls back to level 1 and default maxCharges 2', async () => {
        setupRuntime(); // no stored charges → currentCharges = maxCharges
        mockCombat({ creatures: [{ name: 'Goblin' }] }, { name: 'Goblin' });

        const ps = { name: 'Paladin1', level: undefined, class: { class_levels: [] } };
        const result = await handle(makeAction(), ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('activated against Goblin');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1', 'channelDivinityCharges', 1, campaignName,
        );
    });

    it('applyTargetChoice: channel_divinity maxCharges used when stored charges are null', async () => {
        setupRuntime();
        mockCombat({ creatures: [{ name: 'Orc' }] });

        const ps = makePlayerStats({
            level: 3,
            class: { class_levels: [undefined, undefined, { channel_divinity: 3 }] },
        });
        const result = await applyTargetChoice(makeAction(), ps, campaignName, 'Orc');

        expect(result.type).toBe('popup');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1', 'channelDivinityCharges', 2, campaignName,
        );
    });

    it('free reactivation when previous target at 0 HP via hit_points.current format', async () => {
        setupRuntime({ vowOfEnmityTarget: 'Goblin', vowOfEnmityCostPaid: true, activeBuffs: [] });
        mockCombat({ creatures: [{ name: 'Goblin', hit_points: { current: 0 } }, { name: 'Orc', currentHp: 10 }] }, { name: 'Orc' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('reactivated against Orc');
        expect(result.payload.description).toContain('Previous target defeated');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            'Paladin1', 'channelDivinityCharges', expect.any(Number), campaignName,
        );
    });

    it('free reactivation when previous target has neither HP field (fallback 0 = defeated)', async () => {
        setupRuntime({ vowOfEnmityTarget: 'Goblin', vowOfEnmityCostPaid: true, activeBuffs: [] });
        mockCombat({ creatures: [{ name: 'Goblin' }, { name: 'Orc', currentHp: 10 }] }, { name: 'Orc' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('reactivated against Orc');
        expect(result.payload.description).toContain('Previous target defeated');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            'Paladin1', 'channelDivinityCharges', expect.any(Number), campaignName,
        );
    });

    it('free reactivation against the same target name does not mention transfer', async () => {
        setupRuntime({ vowOfEnmityTarget: 'Goblin', vowOfEnmityCostPaid: true, activeBuffs: [] });
        mockCombat({ creatures: [{ name: 'Goblin', currentHp: 0 }] }, { name: 'Goblin' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('reactivated against Goblin');
        expect(result.payload.description).toContain('Previous target defeated');
        expect(result.payload.description).not.toContain('Transferred');
    });

    it('cost message pluralizes charges and reports depletion', async () => {
        setupRuntime({ channelDivinityCharges: 2, activeBuffs: [] });
        mockCombat({ creatures: [{ name: 'Goblin' }] }, { name: 'Goblin' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.payload.description).toBe(
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
        addEntry.mockRejectedValueOnce(new Error('log failed'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(consoleSpy).toHaveBeenCalledWith(
            '[vowOfEnmity] Error logging:',
            expect.any(Error),
        );
    });
});

// ─── setupVowTransferListener ───

describe('vowOfEnmityHandler setupVowTransferListener', () => {

    // Activate a vow against Goblin so the listener is registered, then wipe
    // the activation writes so post-dispatch assertions see only the listener.
    async function registerVow(initial = {}) {
        const state = setupRuntime({ channelDivinityCharges: 1, ...initial });
        mockCombat({ creatures: [{ name: 'Goblin', currentHp: 5 }] }, { name: 'Goblin' });
        await handle(makeAction(), makePlayerStats(), campaignName);
        runtimeState.setRuntimeValue.mockClear();
        // fix#354(b): expose the store so arms can corrupt it post-activation.
        return state;
    }

    it('clears vow and filters vow_of_enmity from attacker and target buffs, preserving unrelated buffs', async () => {
        // fix#354(b) sites 3+4 valid-arms: validate-first keeps filter+write VERBATIM.
        await registerVow({
            'Paladin1:activeBuffs:test-campaign': [vowBuff, blessBuff],
            'Goblin:activeBuffs:test-campaign': [markedBuff],
        });

        mockCombat({ creatures: [{ name: 'Goblin', currentHp: 0 }] });
        await dispatchSummaryUpdate();

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1', 'vowOfEnmityTarget', null, campaignName,
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1', 'vowOfEnmityCostPaid', null, campaignName,
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1', 'activeBuffs', [blessBuff], campaignName,
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Goblin', 'activeBuffs', [markedBuff], campaignName,
        );
    });

    it('clears vow using hit_points.current format', async () => {
        await registerVow();

        mockCombat({ creatures: [{ name: 'Goblin', hit_points: { current: 0 } }] });
        await dispatchSummaryUpdate();

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1', 'vowOfEnmityTarget', null, campaignName,
        );
    });

    it('clears vow using fallback 0 when both HP fields are missing', async () => {
        await registerVow();

        mockCombat({ creatures: [{ name: 'Goblin' }] });
        await dispatchSummaryUpdate();

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1', 'vowOfEnmityTarget', null, campaignName,
        );
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

        expect(consoleSpy).toHaveBeenCalledWith(
            '[vowOfEnmity] Refusing vow_of_enmity activeBuffs rewrite — stored activeBuffs is not an array:',
            'Paladin1', null,
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            '[vowOfEnmity] Refusing vow_of_enmity activeBuffs rewrite — stored activeBuffs is not an array:',
            'Goblin', null,
        );
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            'Paladin1', 'activeBuffs', expect.anything(), campaignName,
        );
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            'Goblin', 'activeBuffs', expect.anything(), campaignName,
        );
        // Vow-completes-on-death latch clears are unrelated keys: still land.
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1', 'vowOfEnmityTarget', null, campaignName,
        );
        consoleSpy.mockRestore();
    });

    it('non-array truthy attacker store never blocks the valid target clear (per-leg independent guards, fix#354(b))', async () => {
        await registerVow({
            'Paladin1:activeBuffs:test-campaign': 'corrupt',
            'Goblin:activeBuffs:test-campaign': [vowBuff, markedBuff],
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockCombat({ creatures: [{ name: 'Goblin', currentHp: 0 }] });
        await dispatchSummaryUpdate();

        expect(consoleSpy).toHaveBeenCalledWith(
            '[vowOfEnmity] Refusing vow_of_enmity activeBuffs rewrite — stored activeBuffs is not an array:',
            'Paladin1', 'corrupt',
        );
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            'Paladin1', 'activeBuffs', expect.anything(), campaignName,
        );
        // Valid leg rewrites verbatim: vow markers stripped, foreign buff kept.
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Goblin', 'activeBuffs', [markedBuff], campaignName,
        );
        consoleSpy.mockRestore();
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

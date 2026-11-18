// @maintained-by-ai
// Consumerless save-prompt resolution (bug-shieldbash-save-resolved-after-reload-is-a-dead-end).
// A save prompt REPLAYS after a tab reload by design (SSE snapshot law), but the
// createSaveListener continuation that consumes the modal's local `save-result`
// dispatch is a page-local async frame — it died with the previous page. Before
// this lane, resolving a replayed prompt was a silent dead end: NO save_result
// row, NO outcome row (the "must make a STR saving throw" row dangled as the
// last trace), and the FT-082 `_shieldBashBaseAttack` stash + campaign
// lastAttack clobber stayed unrestored. Locks:
//  • a listener-family prompt (row present in pendingSaveListenerPrompts) with
//    NO live same-page consumer resolves honestly: generic save_result row +
//    save_lapsed audit row, and the dangling FT-082 stash is restored
//    store-side (campaign lastAttack ← stash, stash evicted);
//  • a LIVE same-page createSaveListener consumer suppresses the lane entirely
//    (live chain byte-unchanged — one roll, one row pair, no lapse copy);
//  • modal-family prompts (never listed in pendingSaveListenerPrompts) are
//    byte-inert;
//  • suppressOutcomeLog (turn-END repeat-save lanes that stamp their own
//    attributed row) skips ONLY the generic save_result row;
//  • the un-rolled Dismiss variant (detail null) writes no save_result, an
//    honest dismissed-lapse row, and still restores the stash;
//  • no stash ⇒ no lastAttack write (self-guarded restore is byte-inert for
//    every non-Shield-Bash lane).
// Uses the REAL useRuntimeState module (store + fetch lane), sibling
// convention to savePrompt.drain-evict.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

let guidCounter = 0;
vi.mock('../../ui/utils.js', () => ({
    default: { guid: vi.fn(() => `cr-${++guidCounter}`) },
}));

vi.mock('../../shared/abilityLookup.js', () => ({
    getAbilityModifier: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { getRuntimeValue, setRuntimeValue, clearRuntimeState, getAllStoreKeys, listeners } from '../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener, resolveConsumerlessSavePrompt } from './savePrompt.js';
import { addEntry } from '../../ui/logService.js';

const CAMPAIGN = 'test-campaign';

const flush = () => new Promise(r => setTimeout(r, 0));

let fetchSpy;

function clearAllStores() {
    for (const key of getAllStoreKeys()) clearRuntimeState(key);
    listeners.clear();
}

function seedReplay(promptId, { stashHolder, stash } = {}) {
    // Store truth as it exists after a reload: the prompt was armed by a chain
    // that has since died, so the books carry its rows but no local consumer.
    setRuntimeValue('campaign', 'pendingSavePrompts', { [promptId]: { promptId, campaignName: CAMPAIGN } }, CAMPAIGN);
    setRuntimeValue('campaign', 'pendingSaveListenerPrompts', [promptId], CAMPAIGN);
    if (stashHolder) {
        setRuntimeValue(stashHolder, '_shieldBashBaseAttack', stash, CAMPAIGN);
    }
    fetchSpy.mockClear();
    addEntry.mockClear();
}

function replayedPrompt(promptId, extra = {}) {
    return {
        promptId,
        targetName: 'Goblin',
        attackerName: 'EvasiveFighter',
        saveType: 'STR',
        saveDc: 17,
        dcSuccess: false,
        sourceName: 'Shield Bash',
        ...extra,
    };
}

const FAILED_DETAIL = { promptId: 'unused', success: false, roll: 7, total: 6, saveBonus: -1 };
const GLAIVE_STASH = { attackerName: 'EvasiveFighter', targetName: 'Goblin', attackName: 'Glaive', damageType: 'Slashing', total: 12, hit: true };

beforeEach(() => {
    clearAllStores();
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
});

describe('resolveConsumerlessSavePrompt — replayed rider prompt, chain dead with the previous page', () => {
    it('writes the generic save_result row + a save_lapsed audit row and restores the dangling FT-082 stash', async () => {
        const promptId = 'orphan-1';
        seedReplay(promptId, { stashHolder: 'EvasiveFighter', stash: { ...GLAIVE_STASH } });

        resolveConsumerlessSavePrompt(CAMPAIGN, replayedPrompt(promptId), { ...FAILED_DETAIL, promptId });
        await flush();

        const rows = addEntry.mock.calls.map(([, entry]) => entry);
        const saveResultRow = rows.find(e => e.type === 'save_result');
        const lapseRow = rows.find(e => e.type === 'automation' && e.automationType === 'save_lapsed');
        expect(saveResultRow).toMatchObject({
            characterName: 'EvasiveFighter',
            targetName: 'Goblin',
            saveType: 'STR',
            saveDc: 17,
            success: false,
        });
        expect(saveResultRow.description).toContain('Goblin failed STR save (DC 17');
        expect(saveResultRow.description).toContain('rolled 7');
        expect(lapseRow).toMatchObject({
            automationDetail: 'save_lapsed',
            characterName: 'EvasiveFighter',
            abilityName: 'Shield Bash',
            targetName: 'Goblin',
            saveType: 'STR',
            saveDc: 17,
        });
        expect(lapseRow.description).toContain('resolved after a page reload');
        expect(lapseRow.description).toContain('lapsed with the lost page');
        // FT-082: campaign lastAttack re-stamped to the base weapon attack and
        // the stash evicted — store-side, with the producing page gone.
        expect(getRuntimeValue('campaign', 'lastAttack', CAMPAIGN)).toMatchObject({ attackName: 'Glaive' });
        expect(getRuntimeValue('EvasiveFighter', '_shieldBashBaseAttack', CAMPAIGN)).toBeNull();
    });

    it('suppresses entirely while a same-page createSaveListener consumer is live (live chain unchanged)', async () => {
        const { promptId } = createSaveListener(CAMPAIGN, {
            targetName: 'Goblin', attackerName: 'EvasiveFighter', saveType: 'STR', saveDc: 17, sourceName: 'Shield Bash',
        });
        seedReplay(promptId, { stashHolder: 'EvasiveFighter', stash: { ...GLAIVE_STASH } });

        resolveConsumerlessSavePrompt(CAMPAIGN, replayedPrompt(promptId), { ...FAILED_DETAIL, promptId });
        await flush();

        expect(addEntry).not.toHaveBeenCalled();
        expect(getRuntimeValue('campaign', 'lastAttack', CAMPAIGN)).toBeNull();
        expect(getRuntimeValue('EvasiveFighter', '_shieldBashBaseAttack', CAMPAIGN)).toMatchObject({ attackName: 'Glaive' });
    });

    it('is byte-inert for modal-family prompts (no pendingSaveListenerPrompts row)', async () => {
        seedReplay('family-1');
        setRuntimeValue('campaign', 'pendingSaveListenerPrompts', ['someone-else'], CAMPAIGN);
        fetchSpy.mockClear();
        addEntry.mockClear();

        resolveConsumerlessSavePrompt(CAMPAIGN, replayedPrompt('family-1'), { ...FAILED_DETAIL, promptId: 'family-1' });
        await flush();

        expect(addEntry).not.toHaveBeenCalled();
    });

    it('honors suppressOutcomeLog — own-attributed lanes skip only the generic save_result row', async () => {
        const promptId = 'repeat-1';
        seedReplay(promptId);

        resolveConsumerlessSavePrompt(CAMPAIGN, replayedPrompt(promptId, { suppressOutcomeLog: true }), { ...FAILED_DETAIL, promptId });
        await flush();

        const rows = addEntry.mock.calls.map(([, entry]) => entry);
        expect(rows.some(e => e.type === 'save_result')).toBe(false);
        expect(rows.filter(e => e.automationType === 'save_lapsed')).toHaveLength(1);
    });

    it('un-rolled Dismiss (null detail): no save_result row, an honest dismissed-lapse row, stash still restored', async () => {
        const promptId = 'orphan-2';
        seedReplay(promptId, { stashHolder: 'EvasiveFighter', stash: { ...GLAIVE_STASH } });

        resolveConsumerlessSavePrompt(CAMPAIGN, replayedPrompt(promptId), null);
        await flush();

        const rows = addEntry.mock.calls.map(([, entry]) => entry);
        expect(rows.some(e => e.type === 'save_result')).toBe(false);
        const lapseRow = rows.find(e => e.automationType === 'save_lapsed');
        expect(lapseRow.description).toContain('dismissed after a page reload before rolling');
        expect(getRuntimeValue('campaign', 'lastAttack', CAMPAIGN)).toMatchObject({ attackName: 'Glaive' });
        expect(getRuntimeValue('EvasiveFighter', '_shieldBashBaseAttack', CAMPAIGN)).toBeNull();
    });

    it('no dangling stash ⇒ no lastAttack write (self-guarded restore is inert for other lanes)', async () => {
        const promptId = 'orphan-3';
        seedReplay(promptId);

        resolveConsumerlessSavePrompt(CAMPAIGN, replayedPrompt(promptId, { sourceName: 'Poison' }), { ...FAILED_DETAIL, promptId });
        await flush();

        expect(getRuntimeValue('campaign', 'lastAttack', CAMPAIGN)).toBeNull();
        const lastAttackPosts = fetchSpy.mock.calls.filter(([u, opts]) => String(u).endsWith('/lastAttack') && opts?.method === 'POST');
        expect(lastAttackPosts).toHaveLength(0);
        // but the outcome itself is still logged honestly, not a silent void
        const rows = addEntry.mock.calls.map(([, entry]) => entry);
        expect(rows.some(e => e.type === 'save_result')).toBe(true);
        expect(rows.some(e => e.automationType === 'save_lapsed')).toBe(true);
    });
});

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
// Lapsed-copy liveness branch (backlog 2026-11-18 NB): the reload-worded copy
// must only claim a reload when the producer page is actually gone. The
// truthful signal: createSaveListener stamps an owner-tab token on its armed
// pendingSavePrompts row and the owning page STRIPS its markers via a
// keepalive POST on `pagehide` — so a reloaded/closed producer leaves no live
// marker (byte-identical reload copy) while a parked-LIVE peer's foreign
// token drives honest "from another window" copy asserting NEITHER "after a
// page reload" NOR "with the lost page" (both rolled and dismissed branches).
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

function seedReplay(promptId, { stashHolder, stash, ownerTab } = {}) {
    // Store truth as it exists after a reload: the prompt was armed by a chain
    // that has since died, so the books carry its rows but no local consumer
    // (and no live owner-tab marker — a reloaded/closed producer stripped it
    // on pagehide). Pass ownerTab to project a parked-LIVE peer page instead.
    setRuntimeValue('campaign', 'pendingSavePrompts', {
        [promptId]: { promptId, campaignName: CAMPAIGN, ...(ownerTab ? { ownerTab } : {}) },
    }, CAMPAIGN);
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

// Byte-exact lapse copies per branch (backlog 2026-11-18 NB): the reload face
// stays byte-identical to the original fix wording; the live-peer face
// asserts NEITHER "after a page reload" NOR "with the lost page".
const RELOAD_ROLLED_COPY = "Goblin's STR save (DC 17) against Shield Bash was resolved after a page reload — the Shield Bash awaiting it lapsed with the lost page (effect not applied, no chooser available).";
const RELOAD_DISMISSED_COPY = "Goblin's STR save (DC 17) against Shield Bash was dismissed after a page reload before rolling — the Shield Bash lapsed with the lost page (no effect).";
const LIVE_ROLLED_COPY = "Goblin's STR save (DC 17) against Shield Bash was resolved from another window — the Shield Bash awaiting it lapsed (effect not applied, no chooser available).";
const LIVE_DISMISSED_COPY = "Goblin's STR save (DC 17) against Shield Bash was dismissed from another window before rolling — the Shield Bash lapsed (no effect).";

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
        expect(lapseRow.description).toBe(RELOAD_ROLLED_COPY);
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
        expect(lapseRow.description).toBe(RELOAD_DISMISSED_COPY);
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

// The liveness signal itself (backlog 2026-11-18 NB): an owner-tab token
// rides the armed pendingSavePrompts row (arm-time write) and the owning page
// strips its markers on `pagehide` via a keepalive POST — the EVENT-DRIVEN
// seam that makes "producer dead" and "producer parked on a live peer"
// distinguishable cross-tab without any wall-clock wait.
describe('save-listener liveness marker — arm-time stamp + pagehide strip', () => {
    const SAVES_URL = `/api/campaigns/${CAMPAIGN}/pendingSavePrompts`;

    it('createSaveListener stamps its owner-tab marker onto the armed pendingSavePrompts row', () => {
        const { promptId } = createSaveListener(CAMPAIGN, {
            targetName: 'Goblin', saveType: 'STR', saveDc: 17, sourceName: 'Shield Bash',
        });

        const posts = fetchSpy.mock.calls.filter(([u, opts]) => u === SAVES_URL && opts?.method === 'POST');
        const armedRow = JSON.parse(posts.at(-1)[1].body).value[promptId];
        expect(typeof armedRow.ownerTab).toBe('string');
        expect(armedRow.ownerTab.length).toBeGreaterThan(0);
    });

    it('pagehide strips ONLY this page\'s markers via a keepalive POST (peer markers ride untouched)', () => {
        setRuntimeValue('campaign', 'pendingSavePrompts', {
            'peer-1': { promptId: 'peer-1', campaignName: CAMPAIGN, ownerTab: 'tab-some-other-page' },
        }, CAMPAIGN);
        const { promptId } = createSaveListener(CAMPAIGN, {
            targetName: 'Goblin', saveType: 'STR', saveDc: 17, sourceName: 'Shield Bash',
        });
        fetchSpy.mockClear();

        window.dispatchEvent(new Event('pagehide'));

        const strips = fetchSpy.mock.calls.filter(([u, opts]) => u === SAVES_URL && opts?.method === 'POST');
        expect(strips).toHaveLength(1);
        expect(strips[0][1].keepalive).toBe(true);
        const next = JSON.parse(strips[0][1].body).value;
        const strippedRow = next[promptId];
        expect(strippedRow).toBeTruthy();
        expect(strippedRow.ownerTab).toBeUndefined();
        expect(strippedRow.targetName).toBe('Goblin'); // prompt payload fields ride untouched
        expect(next['peer-1'].ownerTab).toBe('tab-some-other-page'); // foreign marker untouched
    });
});

// Live-peer lapse copy (backlog 2026-11-18 NB): the two-tab face — tab A
// parks the armed chain (foreign owner-tab marker still live on the row),
// tab B answers the replay. The lapse row must NOT claim anything reloaded.
describe('resolveConsumerlessSavePrompt — producer parked on a LIVE peer page (two-tab face)', () => {
    it('rolled: live-peer copy replaces the reload assertion (both forbidden phrases absent)', async () => {
        const promptId = 'live-peer-1';
        seedReplay(promptId, { stashHolder: 'EvasiveFighter', stash: { ...GLAIVE_STASH }, ownerTab: 'tab-some-other-page' });

        resolveConsumerlessSavePrompt(CAMPAIGN, replayedPrompt(promptId), { ...FAILED_DETAIL, promptId });
        await flush();

        const rows = addEntry.mock.calls.map(([, entry]) => entry);
        const lapseRows = rows.filter(e => e.automationType === 'save_lapsed');
        expect(lapseRows).toHaveLength(1);
        expect(lapseRows[0].description).toBe(LIVE_ROLLED_COPY);
        expect(lapseRows[0].description).not.toContain('after a page reload');
        expect(lapseRows[0].description).not.toContain('with the lost page');
        expect(lapseRows[0].reason).toContain('from another live window');
        // the rest of the rescue lane is unchanged: generic save_result row
        // still rides above and the FT-082 stash is still restored.
        expect(rows.some(e => e.type === 'save_result')).toBe(true);
        expect(getRuntimeValue('campaign', 'lastAttack', CAMPAIGN)).toMatchObject({ attackName: 'Glaive' });
        expect(getRuntimeValue('EvasiveFighter', '_shieldBashBaseAttack', CAMPAIGN)).toBeNull();
    });

    it('dismissed (null detail): live-peer copy, no save_result row, stash still restored', async () => {
        const promptId = 'live-peer-2';
        seedReplay(promptId, { stashHolder: 'EvasiveFighter', stash: { ...GLAIVE_STASH }, ownerTab: 'tab-some-other-page' });

        resolveConsumerlessSavePrompt(CAMPAIGN, replayedPrompt(promptId), null);
        await flush();

        const rows = addEntry.mock.calls.map(([, entry]) => entry);
        expect(rows.some(e => e.type === 'save_result')).toBe(false);
        const lapseRows = rows.filter(e => e.automationType === 'save_lapsed');
        expect(lapseRows).toHaveLength(1);
        expect(lapseRows[0].description).toBe(LIVE_DISMISSED_COPY);
        expect(lapseRows[0].description).not.toContain('after a page reload');
        expect(lapseRows[0].description).not.toContain('with the lost page');
        expect(lapseRows[0].reason).toContain('from another live window');
        expect(getRuntimeValue('campaign', 'lastAttack', CAMPAIGN)).toMatchObject({ attackName: 'Glaive' });
        expect(getRuntimeValue('EvasiveFighter', '_shieldBashBaseAttack', CAMPAIGN)).toBeNull();
    });

    it('the armed row was already swept (no marker visible at write time) ⇒ honest reload copy fallback', async () => {
        const promptId = 'live-peer-3';
        seedReplay(promptId, { ownerTab: undefined });
        setRuntimeValue('campaign', 'pendingSavePrompts', {}, CAMPAIGN);
        setRuntimeValue('campaign', 'pendingSaveListenerPrompts', [promptId], CAMPAIGN);
        addEntry.mockClear();

        resolveConsumerlessSavePrompt(CAMPAIGN, replayedPrompt(promptId), { ...FAILED_DETAIL, promptId });
        await flush();

        const lapseRow = addEntry.mock.calls.map(([, e]) => e).find(e => e.automationType === 'save_lapsed');
        expect(lapseRow.description).toBe(RELOAD_ROLLED_COPY);
    });
});

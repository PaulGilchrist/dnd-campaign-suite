/**
 * Encounter Playtest lane (playtest plan 2026-11-25): play-test a saved
 * Encounter Builder encounter against the real party with ZERO persisted
 * campaign impact. The whole test lives inside a snapshot/rollback envelope:
 *
 *   start:  POST /admin/snapshot (restore point)
 *        → stamp campaign key `playtest` { active, snapshot, encounterName }
 *          (server-first, so a reload/crash re-shows the banner)
 *        → stage the battle map via the travel-event staging lane
 *          (stageEventEncounterMap: wipe-and-reseed randomized 1/2 + 3/4 +
 *          full cover, party tokens + monster ring, /activate at the end)
 *        → join monsters through the normal EB lane (addMonstersToInitiative,
 *          full-party fan-out) so difficulty is measured against real HP.
 *
 *   end:    POST /admin/rollback { filename } → the server replaces the
 *           campaign dir with the restore point and reloads it; the same
 *           postRestoreNotice + full-reload handoff CampaignAdmin's Restore
 *           rows ride, so the app lands back on the campaign with the
 *           "restored" banner. The playtest stamp itself vanished with the
 *           rollback (it was written AFTER the snapshot) — no manual clear
 *           on the success lane.
 *
 * Everything the test dirties (log, HP/conditions, XP, loot drafts, map
 * edits, overlays, the staged doc + active-map pointer) rolls back together;
 * there is deliberately no per-write suppression plumbing. The soft UX gates
 * (loot panel disable, autoReward guard) exist only so the GM is never
 * offered writes whose results would evaporate.
 *
 * Failure legs before the test even starts: the stamp is evicted
 * (deleteRuntimeKey) so the banner never lies about an active test; an
 * orphan snapshot is harmless under retention-4.
 */
import utils from '../ui/utils.js';
import { PLAYTEST_KEY } from '../automation/common/campaignKeys.js';
import { getRuntimeValue, setRuntimeValue, deleteRuntimeKey } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../ui/logService.js';
import { addMonstersToInitiative } from './encounterToInitiative.js';
import { stageEventEncounterMap } from './encounterStagingService.js';
import { generateOutdoorEncounter } from './outdoorEncounterGenerator.js';
import { generateMonsterPlacements } from './monsterTokenPlacement.js';

const STAGE_GRID = 30;
const STAGE_TERRAIN = 'plains';
const STAGE_HEX = { q: 0, r: 0 };

/** True while a playtest session is stamped on the campaign. */
export function isPlaytestActive(campaignName) {
    return getRuntimeValue('campaign', PLAYTEST_KEY, campaignName)?.active === true;
}

export async function startEncounterPlaytest({
    campaignName,
    encounterName,
    selectedMonsters,
    characters = [],
}) {
    // 1. Restore point FIRST — nothing below may write before the zip exists.
    const snapshotRes = await fetch(
        `/api/campaigns/${encodeURIComponent(campaignName)}/admin/snapshot`,
        { method: 'POST' }
    );
    const snapshot = await snapshotRes.json().catch(() => ({}));
    if (!snapshotRes.ok) {
        throw new Error(snapshot.error || 'Failed to snapshot the campaign');
    }

    // 2. Stamp the session (server-first: every GM tab's banner follows via
    // SSE, and a mid-test reload re-reads the truth). AWAITED on purpose: the
    // stamp POST must be settled BEFORE anything that could roll back runs —
    // a stamp write still in flight when the rollback extracts would
    // re-materialize the playtest ghost over the restored campaign.
    await setRuntimeValue('campaign', PLAYTEST_KEY, {
        active: true,
        snapshot: snapshot.filename,
        encounterName: encounterName || 'Unnamed Encounter',
    }, campaignName);

    try {
        // 3. Stage the battle map: biome decor + party fan from the outdoor
        // generator, monster spawn ring from the shared placement rule, and
        // the staging service's fresh randomized cover — one stable doc,
        // activated through the /activate lane.
        const marchingOrder = characters.map((c) => utils.getName(c.name));
        const outdoors = generateOutdoorEncounter(
            STAGE_TERRAIN, STAGE_GRID, marchingOrder, STAGE_HEX.q, STAGE_HEX.r
        );
        const monsterItems = generateMonsterPlacements(
            selectedMonsters.map((m) => ({ name: m.name, qty: m.qty || 1 })),
            STAGE_GRID
        );
        await stageEventEncounterMap({
            campaignName,
            terrainType: STAGE_TERRAIN,
            q: STAGE_HEX.q,
            r: STAGE_HEX.r,
            gridSize: STAGE_GRID,
            decorItems: outdoors.placedItems,
            monsterItems,
            players: outdoors.players,
            bgFill: outdoors.bgFill,
        });

        // 4. Board: the normal EB join lane (initiative rolls, party fan-out,
        // combatSummary writes) — the playtest plays the REAL game, the
        // rollback does the undoing.
        await addMonstersToInitiative(selectedMonsters, characters, campaignName);
    } catch (err) {
        // The test never started — evict the stamp so no stranded banner
        // claims an active playtest. (Staged doc/activation residue is fine:
        // the stage is a disposable doc every future use overwrites.)
        deleteRuntimeKey('campaign', PLAYTEST_KEY, campaignName);
        throw err;
    }

    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'encounter_playtest_started',
        characterName: 'GM',
        description: `Playtest started for "${encounterName || 'Unnamed Encounter'}" `
            + `(restore point ${snapshot.filename}) — every change rolls back when the GM ends the playtest.`,
    }).catch((e) => console.error('[playtestService] start audit failed:', e));

    return { snapshot: snapshot.filename };
}

/**
 * End the playtest: rollback to the recorded restore point, then hand the
 * acting tab through the same postRestoreNotice + full reload as the
 * CampaignAdmin Restore lane (App boot re-selects the campaign and shows the
 * "restored" banner). Throws with a plain-English message on refusal (e.g. a
 * pruned snapshot) so the banner stays up and the GM can restore manually.
 */
export async function endEncounterPlaytest(campaignName) {
    const stamp = getRuntimeValue('campaign', PLAYTEST_KEY, campaignName);
    if (stamp?.active !== true) {
        throw new Error('No playtest session is active');
    }
    const res = await fetch(
        `/api/campaigns/${encodeURIComponent(campaignName)}/admin/rollback`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: stamp.snapshot }),
        }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const error = new Error(
            res.status === 404
                ? `Restore point ${stamp.snapshot} no longer exists — roll back from Campaign Admin's snapshot list instead`
                : (data.error || 'Rollback failed')
        );
        error.status = res.status;
        throw error;
    }
    try {
        sessionStorage.setItem('postRestoreNotice', JSON.stringify({
            campaign: campaignName,
            restored: data.restored,
        }));
    } catch (err) {
        console.error('[playtestService] Failed to store post-restore notice:', err);
    }
    window.location.reload();
}

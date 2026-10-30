// Sequential write queue for combatSummary to prevent race conditions
// when multiple applyDamageToTarget calls fire storage.set in quick succession.
// Each campaign gets its own queue so writes for different campaigns can run in parallel.
const combatSummaryQueues = new Map();

function getCombatSummaryQueue(campaignName) {
    if (!combatSummaryQueues.has(campaignName)) {
        combatSummaryQueues.set(campaignName, {
            pending: Promise.resolve(),
        });
    }
    return combatSummaryQueues.get(campaignName);
}

const storage = {
    get: async (key, campaignName) => {
        if (!campaignName) {
            return null;
        }
        try {
            const fullUrl = `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(key)}`;
            const response = await fetch(fullUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.value != null) {
                    return data.value;
                }
            }
        } catch (err) {
            console.error(`storage.get failed for key "${key}" in campaign "${campaignName}"`, err);
        }
        return null;
    },
    set: (key, value, campaignName, opts) => {
        if (!campaignName) {
            console.error('storage.set called with undefined campaignName', { key, value, stack: new Error().stack });
            return Promise.resolve();
        }
        if (key === 'combatSummary') {
            const queue = getCombatSummaryQueue(campaignName);
            const current = queue.pending;
            // Board writes resolve TRUE only when the server acknowledged with an
            // ok response, FALSE on network failure/HTTP error — the awaited-writer
            // contract (EB Join awaits this and aborts its `joined` log row on false,
            // bug-eb-join-swallowed-network-fail-phantom-row). The queue chain itself
            // still swallows rejections: un-awaited writers keep the old fire-and-
            // forget behaviour, and one failed write cannot poison later ones.
            // Guarded writers (bug-initiative-concurrent-npc-spawn-lost-update) pass
            // opts.baseVersion — the board version their mutation was built from. The
            // stamp rides in the POST body (server 409s a stale base, the .ct-* lanes'
            // jsonEntityCrud doctrine) and the call resolves { ok, status } so the
            // caller can tell a 409 conflict from a transport failure. Callers without
            // opts keep the TRUE/FALSE bytes above unchanged.
            const guarded = !!(opts && typeof opts.baseVersion === 'number');
            queue.pending = current.then(async () => {
                const fullUrl = `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(key)}`;
                try {
                    const response = await fetch(fullUrl, {
                        method: 'POST',
                        mode: 'cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(guarded ? { value, baseVersion: opts.baseVersion } : { value })
                    });
                    return guarded ? { ok: response.ok, status: response.status } : response.ok;
                } catch (e) {
                    console.error("[storage:error]", e);
                    return guarded ? { ok: false, status: 0 } : false;
                }
            });
            return queue.pending;
        }
        const fullUrl = `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(key)}`;
        return fetch(fullUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
          }).catch((e) => { console.error("[storage:error]", e); });
      }
}

export default storage

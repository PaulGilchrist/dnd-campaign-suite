import { cloneDeep } from 'lodash';

// Sequential write queue for combatSummary to prevent race conditions
// when multiple applyDamageToTarget calls fire storage.set in quick succession.
// Each campaign gets its own queue so writes for different campaigns can run in parallel.
const combatSummaryQueues = new Map();

// ── Scoped PATCH coalescing (backlog 2026-11-05 CV) ────────────────────
// Burst arming was chatty: 3 rapid same-select target changes shipped 3
// in-flight scoped PATCHes + 3 full-board SSE echoes (CU PT2 measured a
// 62 ms window). The lane is already last-writer-wins-CORRECT (the server
// by-name-merges every body into live board truth), so the fix is pure
// chattiness: buffered bodies for the SAME (campaign, key) merge client-side
// into ONE PATCH carrying the last-writer field content → one server echo.
// Quiet window with a hard max-wait: bursts under ~50 ms apart coalesce,
// a 300 ms gap lands in a separate window (no unbounded deferral), and a
// continuous stream flushes at the cap.
const PATCH_COALESCE_QUIET_MS = 120;
const PATCH_COALESCE_MAX_MS = 250;
const patchBuffers = new Map(); // `${campaign}\u0000${key}` → coalescing buffer

function isPlainRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Non-empty array whose every element is a record with a string name —
// the combatSummary.creatures convention (mirrors campaigns-changedata.js).
function namedRecords(value) {
    return Array.isArray(value) && value.length > 0 &&
        value.every((r) => isPlainRecord(r) && typeof r.name === 'string');
}

// Field-level merge of a queued patch body into the pending coalesced body,
// mirroring the SERVER merge doctrine (campaigns-changedata.js
// mergePatchFields): object+object recurse, named-record arrays merge per
// record by name, anything else the later field replaces. One deliberate
// deviation: a record with no earlier match is APPENDED rather than skipped —
// within one tab's own burst every touched creature must reach the server
// (a later split window still merges each record by name board-side).
function mergePatchBody(target, patch) {
    for (const [field, value] of Object.entries(patch)) {
        if (isPlainRecord(target[field]) && isPlainRecord(value)) {
            mergePatchBody(target[field], value);
        } else if (namedRecords(target[field]) && namedRecords(value)) {
            for (const record of value) {
                const match = target[field].find((r) => r.name === record.name);
                if (match) {
                    mergePatchBody(match, record);
                } else {
                    const copy = cloneDeep(record);
                    target[field].push(copy);
                }
            }
        } else {
            target[field] = cloneDeep(value);
        }
    }
}

function sendScopedPatch(key, value, campaignName) {
    const fullUrl = `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(key)}`;
    const send = () => fetch(fullUrl, {
        method: 'PATCH',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
    }).then((response) => response.ok)
      .catch((e) => { console.error("[storage:error]", e); return false; });
    if (key === 'combatSummary') {
        // Scoped flushes still serialize through the SAME per-campaign queue
        // as full POSTs. Call-order vs a POST issued during the debounce
        // window may swap, which is content-safe: the scoped body carries
        // only changed fields that the server merges by name into live truth
        // (it never ships a snapshot that could clobber), and the local
        // mirror's full POST carries the same field bytes.
        const queue = getCombatSummaryQueue(campaignName);
        queue.pending = queue.pending.then(send);
        return queue.pending;
    }
    return send();
}

function flushPatchBuffer(coalesceKey) {
    const buffer = patchBuffers.get(coalesceKey);
    if (!buffer) {
        return;
    }
    patchBuffers.delete(coalesceKey);
    clearTimeout(buffer.timer);
    buffer.timer = null;
    const waiters = buffer.waiters;
    buffer.waiters = [];
    let settled;
    try {
        settled = sendScopedPatch(buffer.key, buffer.value, buffer.campaignName);
    } catch (e) {
        // a failed flush must never lose the write for later callers
        console.error("[storage:error]", e);
        settled = Promise.resolve(false);
    }
    waiters.forEach((resolve) => { settled.then(resolve, resolve); });
}

function schedulePatchFlush(coalesceKey, buffer) {
    if (buffer.timer != null) {
        clearTimeout(buffer.timer);
    }
    const elapsed = Date.now() - buffer.firstAt;
    const wait = Math.max(0, Math.min(PATCH_COALESCE_QUIET_MS, PATCH_COALESCE_MAX_MS - elapsed));
    // flushes the coalesced scoped-write batch only — no game state on a clock
    buffer.timer = setTimeout(() => flushPatchBuffer(coalesceKey), wait); // network/save debounce
}

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
      },
    // Scoped field-patch write (backlog 2026-11-04 CR): ships only the
    // changed slice; the server PATCH lane (server/routes/campaigns-changedata.js)
    // merges it into current truth and broadcasts the FULL merged bucket on the
    // normal change-<campaign>-<key> SSE channel — cross-tab adoption is
    // byte-identical to a full POST while the wire stays small.
    // Coalesced (backlog 2026-11-05 CV): same-(campaign,key) writes issued
    // inside the debounce window merge into ONE PATCH carrying the merged
    // last-writer content (→ one full-board echo per burst). Different keys
    // never share a buffer. Each call still returns its own Promise resolving
    // with the shared response.ok byte once the coalesced PATCH lands.
    patch: (key, value, campaignName) => {
        if (!campaignName) {
            console.error('storage.patch called with undefined campaignName', { key, value, stack: new Error().stack });
            return Promise.resolve(false);
        }
        return new Promise((resolve) => {
            const coalesceKey = `${campaignName}\u0000${key}`;
            let buffer = patchBuffers.get(coalesceKey);
            if (!buffer) {
                buffer = { key, campaignName, value: cloneDeep(value), waiters: [], timer: null, firstAt: Date.now() };
                patchBuffers.set(coalesceKey, buffer);
            } else if (isPlainRecord(buffer.value) && isPlainRecord(value)) {
                mergePatchBody(buffer.value, value);
            } else {
                buffer.value = cloneDeep(value); // unmergeable body: last writer replaces
            }
            buffer.waiters.push(resolve);
            schedulePatchFlush(coalesceKey, buffer);
        });
    }
}

export default storage

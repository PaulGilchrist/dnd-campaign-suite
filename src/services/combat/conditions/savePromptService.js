import {
  clearRuntimeState,
  getAllStoreKeys,
  getStore,
  hasRuntimeValue,
  notify,
} from '../../../hooks/runtime/useRuntimeState.js';

// Save prompts key per promptId (mirrors the concentration lane's multi-hit
// collapse fix): back-to-back saves on one target stack as separate keys
// instead of every POST overwriting the same `savePrompt-<Target>` key — a
// drained queue dismissed prompt-by-prompt then DELETEd a key that a sibling
// prompt had already swept (honest 404 since the 2026-10-30 wildcard honesty
// fix) and left the shared key's survivors ambiguous. A missing promptId
// falls back to the legacy target-only key (staged/admin writes and the
// radianceOfDawn producer, which POST without one).
function savePromptKey(targetName, promptId) {
  return promptId
    ? `savePrompt-${targetName}-${promptId}`
    : `savePrompt-${targetName}`;
}

export function sendSavePrompt(campaignName, promptData) {
  const key = savePromptKey(promptData.targetName, promptData.promptId);
  const url = `/api/campaigns/${encodeURIComponent(campaignName)}/${key}`;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: promptData }),
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

// Result keys mirror the prompt lane's per-promptId shape so a late hygiene
// DELETE for one adjudication can never shadow a sibling multi-hit save's
// echo. A promptId-less result (countercharm machine-truth, legacy lanes)
// keeps the bare-target key.
function saveResultKey(targetName, promptId) {
  return promptId
    ? `saveResult-${targetName}-${promptId}`
    : `saveResult-${targetName}`;
}

export function clearSaveResult(campaignName, targetName, promptId) {
  const key = saveResultKey(targetName, promptId);
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'DELETE',
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

// Same hygiene doctrine as the concentration/death-save result lanes
// (a3c10a0ea / death-save-result-key-never-deleted): the result key's only
// job is the SSE broadcast — App.jsx redispatchSaveResult consumes the value
// echo live (it requires event.data.promptId), nothing ever GETs the stored
// key — so once the POST response resolves (the server publishes BEFORE
// responding, and the shared SSE fans messages out in order per connection)
// the echo has served every connected client and the key self-sweeps. The
// DELETE is chained AFTER the POST resolves on purpose (parallel could let
// the null echo outrank the value echo and weaken cross-tab resolution); a
// failed POST never DELETEs. Trailing null echoes are inert.
export function sendSaveResult(campaignName, targetName, resultData) {
  const promptId = resultData?.promptId;
  const key = saveResultKey(targetName, promptId);
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: resultData }),
  })
    .then(() => { clearSaveResult(campaignName, targetName, promptId); })
    .catch((e) => { console.error("[savePromptService] Error:", e); });
}

// Clear takes the change-data key IDENTIFIER the prompt arrived on —
// '<Target>-<promptId>' for per-prompt keys, bare '<Target>' for the
// legacy/staged lane. The modal queues the arrival key verbatim, so Dismiss
// always DELETEs exactly the key that exists and never guesses at a sibling
// shape (the drained-queue 404 class, backlog 2026-11-03).
export function clearSavePrompt(campaignName, keySuffix) {
  const key = `savePrompt-${keySuffix}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'DELETE',
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

function deathSavePromptKey(targetName) {
  return `deathSavePrompt-${targetName}`;
}

// Mirror-existence probe for the target-wide death-save prompt key. The key
// reaches this client's synced runtime store on exactly two lanes: the
// campaign-select seed (every top-level change-data key copies into the
// 'campaign' store, App.jsx seedCampaignRuntimeData) and the live
// `change-<campaign>-deathSavePrompt-<Name>` value echo (not registered as a
// campaign key, App.jsx applyStoreUpdate dispatches it to a character-style
// bucket store named after the full key). Present on either lane ⇒ the server
// holds (or last reported holding) the key; evicted on every confirmed server
// answer (see evictDeathSavePromptMirror) so a resolved prompt never replays
// the double-sweep 404.
function deathSavePromptInMirror(key) {
  return hasRuntimeValue('campaign', key) || getAllStoreKeys().includes(key);
}

// Evict BOTH mirror lanes for the prompt key. The shared null-echo lane only
// mirrors clears for campaign keys (App.jsx handleChangeKeyEvent), so the
// key-named echo bucket survives a DELETE untouched (ghost bucket) and every
// later clear-leg re-DELETEd the dead key — one honest wildcard 404 each
// (backlog LC 2026-11-14 double-sweep face). Same drain-to-evict doctrine as
// deleteRuntimeKey's local delete + notify: once the server has answered the
// DELETE (2xx ⇒ removed, 404 ⇒ never there) this client KNOWS the key is
// absent, so drop the ghost instead of re-probing it. Refused/errored
// responses never evict — a real evict is never silently skipped.
function evictDeathSavePromptMirror(key) {
  if (hasRuntimeValue('campaign', key)) {
    getStore('campaign').delete(key);
    notify('campaign');
  }
  if (getAllStoreKeys().includes(key)) {
    clearRuntimeState(key);
  }
}

export function sendDeathSavePrompt(campaignName, promptData) {
  const key = deathSavePromptKey(promptData.targetName);
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: promptData }),
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

// Mirror-gated evict (backlog 2026-11-14 death-save-prompt-evict-404-noise):
// the recovery clear-legs (CharHitPoints/DeathSavingThrows sheet lanes,
// createCreatureHandlers.writePlayerHp revival, DeathSavePromptModal roll/void)
// previously DELETEd unconditionally, so an HP-0 seeded without ever arming a
// prompt (external full-store POST, sheet-editor drop) probed a key that was
// never created — the wildcard DELETE's honest 404 (campaigns-changedata.js)
// surfaced as console noise on every recovery. Same has()-guard doctrine as
// deleteRuntimeKey's drain-to-evict ("no second DELETE, no honest-404 churn").
// Mirror-gate alone still replayed a 404 once per client after a REAL
// arm+resolve (the ghost bucket survives the resolve DELETE's dropped null
// echo, LC 2026-11-14 double-sweep face), so the response leg now evicts the
// ghost on any server-confirmed answer (2xx/404) — later clear-legs send
// nothing. A non-confirming answer (403/423/5xx/network) keeps the mirror,
// so a genuinely pending evict is retried, never silently skipped.
export function clearDeathSavePrompt(campaignName, targetName) {
  const key = deathSavePromptKey(targetName);
  if (!deathSavePromptInMirror(key)) return;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'DELETE',
  })
    .then((res) => {
      if (res.ok || res.status === 404) evictDeathSavePromptMirror(key);
    })
    .catch((e) => { console.error("[savePromptService] Error:", e); });
}

export function clearDeathSaveResult(campaignName, targetName) {
  const key = `deathSaveResult-${targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'DELETE',
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

// Same hygiene doctrine as the concentration result lane (801017a91): the
// result key's only job is the SSE broadcast — every connected client stamps
// resolvedPromptIds from the value echo (double-roll guard, 6eaf9b101). The
// server publishes that echo synchronously BEFORE responding
// (campaigns-changedata.js publish → res.json) and the shared SSE fans
// messages out in order per connection, so once the POST response resolves,
// each live client's socket already holds the echo ahead of anything a
// DELETE could publish — the echo has served every connected client and the
// key is swept immediately (backlog death-save-result-key-never-deleted:
// stale result surviving until Admin Clear). Event-driven hygiene, no timers
// (No Game Timers rule); the DELETE is chained AFTER the POST resolves on
// purpose — issuing it in parallel could let the null echo reach a client
// before the value echo and weaken the re-roll guard. A failed POST never
// DELETEs (nothing was written). Trailing null echoes are inert in the
// modal's result branch (it requires event.data?.promptId).
export function sendDeathSaveResult(campaignName, targetName, resultData) {
  const key = `deathSaveResult-${targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: resultData }),
  })
    .then(() => { clearDeathSaveResult(campaignName, targetName); })
    .catch((e) => { console.error("[savePromptService] Error:", e); });
}

// Concentration prompts are keyed per promptId so back-to-back damage on one
// concentrating target stacks in the store instead of every hit overwriting
// the same `concentrationPrompt-<Target>` key (multi-hit collapse bug): the
// client queue could show "(1 of 2)" while the server only ever held the
// last prompt, and answering any prompt DELETEd the key and silently voided
// every other pending save for that target. A missing promptId falls back to
// the legacy target-only key (staged/admin writes without a promptId).
function concentrationPromptKey(targetName, promptId) {
  return promptId
    ? `concentrationPrompt-${targetName}-${promptId}`
    : `concentrationPrompt-${targetName}`;
}

export function sendConcentrationPrompt(campaignName, promptData) {
  const key = concentrationPromptKey(promptData.targetName, promptData.promptId);
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: promptData }),
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

// Result keys mirror the prompt lane's per-promptId shape (a3c10a0ea): each
// adjudicated save owns `concentrationResult-<Target>-<promptId>` so a late
// hygiene DELETE for one save can never shadow a sibling multi-hit save's
// echo. A promptId-less result (legacy/staged lane) uses the bare-target key.
function concentrationResultKey(targetName, promptId) {
  return promptId
    ? `concentrationResult-${targetName}-${promptId}`
    : `concentrationResult-${targetName}`;
}

export function clearConcentrationResult(campaignName, targetName, promptId) {
  const key = concentrationResultKey(targetName, promptId);
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'DELETE',
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

// The result key's only job is the SSE broadcast: every connected client
// stamps resolvedPromptIds from the value echo (double-roll guard). The
// server publishes that echo synchronously BEFORE responding
// (campaigns-changedata.js publish → res.json) and the shared SSE fans
// messages out in order per connection, so once the POST response resolves,
// each live client's socket already holds the echo ahead of anything a
// DELETE could publish — the echo has served every connected client and the
// key is swept immediately (backlog 2026-10-29-Z: stale result surviving
// until Admin Clear). Event-driven hygiene, no timers (No Game Timers rule);
// the DELETE is chained AFTER the POST resolves on purpose — issuing it in
// parallel could let the null echo reach a client before the value echo and
// weaken the re-roll guard. A failed POST never DELETEs (nothing was written).
export function sendConcentrationResult(campaignName, targetName, resultData) {
  const promptId = resultData?.promptId;
  const key = concentrationResultKey(targetName, promptId);
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: resultData }),
  })
    .then(() => { clearConcentrationResult(campaignName, targetName, promptId); })
    .catch((e) => { console.error("[savePromptService] Error:", e); });
}

export function clearConcentrationPrompt(campaignName, targetName, promptId) {
  const key = concentrationPromptKey(targetName, promptId);
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'DELETE',
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

export function sendFleshToStonePrompt(campaignName, promptData) {
  const key = `fleshToStonePrompt-${promptData.targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: promptData }),
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

export function clearFleshToStonePrompt(campaignName, targetName) {
  const key = `fleshToStonePrompt-${targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'DELETE',
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

export function sendFleshToStoneResult(campaignName, targetName, resultData) {
  const key = `fleshToStoneResult-${targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: resultData }),
  }).then((res) => res.json()).then(() => {
    window.dispatchEvent(new CustomEvent('flesh-to-stone-result', { detail: { campaignName, targetName, result: resultData } }));
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

export function sendPrismaticSprayIndigoResult(campaignName, targetName, resultData) {
  const key = `prismaticSprayIndigoResult-${targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: resultData }),
  }).then((res) => res.json()).then(() => {
    window.dispatchEvent(new CustomEvent('prismatic-spray-indigo-result', { detail: { campaignName, targetName, result: resultData } }));
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

export function sendPrismaticSprayVioletResult(campaignName, targetName, resultData) {
  const key = `prismaticSprayVioletResult-${targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: resultData }),
  }).then((res) => res.json()).then(() => {
    window.dispatchEvent(new CustomEvent('prismatic-spray-violet-result', { detail: { campaignName, targetName, result: resultData } }));
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

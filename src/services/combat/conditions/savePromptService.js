export function sendSavePrompt(campaignName, promptData) {
  const key = `savePrompt-${promptData.targetName}`;
  const url = `/api/campaigns/${encodeURIComponent(campaignName)}/${key}`;
  console.debug(`[saveDebug] sendSavePrompt POST`, { url, promptId: promptData.promptId, targetName: promptData.targetName });
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: promptData }),
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

export function sendSaveResult(campaignName, targetName, resultData) {
  const key = `saveResult-${targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: resultData }),
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

export function clearSavePrompt(campaignName, targetName) {
  const key = `savePrompt-${targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'DELETE',
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

export function sendDeathSavePrompt(campaignName, promptData) {
  const key = `deathSavePrompt-${promptData.targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: promptData }),
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

export function clearDeathSavePrompt(campaignName, targetName) {
  const key = `deathSavePrompt-${targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'DELETE',
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
}

export function sendDeathSaveResult(campaignName, targetName, resultData) {
  const key = `deathSaveResult-${targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: resultData }),
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
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

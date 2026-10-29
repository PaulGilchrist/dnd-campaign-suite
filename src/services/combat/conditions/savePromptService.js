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

export function sendConcentrationResult(campaignName, targetName, resultData) {
  const key = `concentrationResult-${targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: resultData }),
  }).catch((e) => { console.error("[savePromptService] Error:", e); });
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

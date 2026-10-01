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

export function sendConcentrationPrompt(campaignName, promptData) {
  const key = `concentrationPrompt-${promptData.targetName}`;
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

export function clearConcentrationPrompt(campaignName, targetName) {
  const key = `concentrationPrompt-${targetName}`;
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

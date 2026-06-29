export function sendSavePrompt(campaignName, promptData) {
  const key = `savePrompt-${promptData.targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
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

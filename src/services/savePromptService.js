export function sendSavePrompt(campaignName, promptData) {
  const key = `savePrompt-${promptData.targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: promptData }),
  }).catch(() => {});
}

export function sendSaveResult(campaignName, targetName, resultData) {
  const key = `saveResult-${targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: resultData }),
  }).catch(() => {});
}

export function clearSavePrompt(campaignName, targetName, promptId) {
  const key = `savePromptCleared-${targetName}`;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: { promptId } }),
  }).catch(() => {});
}

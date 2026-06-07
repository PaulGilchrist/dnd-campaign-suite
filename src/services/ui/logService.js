const BASE_URL = '/api/campaigns';

export async function getLog(campaignName) {
  const response = await fetch(`${BASE_URL}/${encodeURIComponent(campaignName)}/log`);
   if (!response.ok) throw new Error('Failed to fetch log');
   return response.json();
}

export async function addEntry(campaignName, entry) {
  const response = await fetch(`${BASE_URL}/${encodeURIComponent(campaignName)}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
   });
   if (!response.ok) throw new Error('Failed to add log entry');
    return response.json();
}

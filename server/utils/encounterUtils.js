import fs from 'fs';
import path from 'path';

/**
 * Helper to get the encounters file path for a campaign
 * @param {string} campaign - Campaign name
 * @returns {string} Path to encounters.json
 */
export const getEncountersFilePath = (campaign) => path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'encounters.json');

/**
 * Helper to read encounters from single file
 * @param {string} campaign - Campaign name
 * @returns {object} Object with encounters array
 */
export const readEncounters = (campaign) => {
  const filePath = getEncountersFilePath(campaign);
  try {
    if (!fs.existsSync(filePath)) {
      return { encounters: [] };
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.error('Error reading encounters file:', error);
    return { encounters: [] };
  }
};

/**
 * Helper to write encounters to single file
 * @param {string} campaign - Campaign name
 * @param {object} data - Data object with encounters array
 */
export const writeEncounters = (campaign, data) => {
  const filePath = getEncountersFilePath(campaign);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

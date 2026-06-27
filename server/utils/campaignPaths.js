import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

export function campaignsRoot() {
  return path.join(ROOT, 'public', 'campaigns');
}

export function campaignDir(campaign) {
  return path.join(ROOT, 'public', 'campaigns', campaign);
}

export function campaignDataDir(campaign) {
  return path.join(campaignDir(campaign), 'data');
}

export function campaignDataFile(campaign, fileName) {
  return path.join(campaignDataDir(campaign), fileName);
}

export function campaignMapsDir(campaign) {
  return path.join(campaignDir(campaign), 'maps');
}

export function campaignImagesDir(campaign) {
  return path.join(campaignDir(campaign), 'images');
}

export function ensureDataDir(campaign) {
  const dir = campaignDataDir(campaign);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function normalizeMapFile(name) {
  return name.endsWith('.json') ? name : `${name}.json`;
}

// @maintained-by-ai
// ─── Lane: rumor-composer article dedupe (backlog 2026-11-03, CK) ───────────
// The starter settlement rumor hardcodes a sentence-initial "The" onto the
// first service name; the shop/guild banks ship ~1400 names already leading
// with "The ", which rendered "The The Quality Emporium hasn't had a caravan…"
// and persisted across regenerate (the settlement is kept). Pins:
//   1. withLeadingArticle collapses only genuine leading articles,
//   2. the composer seam (STARTER_PRESET.seed → saveSettlement rumors) uses it.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createSeededCampaign, withLeadingArticle } from './seededCampaign.js';
import { generateSettlement } from './settlementGenerator.js';
import { saveSettlement } from './settlementsService.js';

vi.mock('../maps/mapsService.js', () => ({
  toKebabCase: (n) => n.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
  createMap: vi.fn(async () => ({ name: 'm', fileName: 'm.json', slug: 'm' })),
  saveMapData: vi.fn(async () => ({ message: 'ok' })),
  loadMapData: vi.fn(async () => ({ name: 'wilds', type: 'outdoor', pois: [] })),
  activateMap: vi.fn(async () => ({ message: 'ok' })),
  deleteMap: vi.fn(async () => ({ message: 'ok' })),
}));

vi.mock('../encounters/encountersService.js', () => ({
  saveEncounter: vi.fn(async () => ({ message: 'ok' })),
  updateEncounter: vi.fn(async () => ({ message: 'ok' })),
}));

vi.mock('./settlementGenerator.js', () => ({
  generateSettlement: vi.fn(async () => ({
    name: 'Thornhollow',
    size: 'village',
    description: 'A quiet village.',
  })),
}));

vi.mock('./settlementsService.js', () => ({
  saveSettlement: vi.fn(async () => ({})),
  loadSettlement: vi.fn(async () => null),
}));
vi.mock('./questsService.js', () => ({
  saveQuests: vi.fn(async () => {}),
  loadQuests: vi.fn(async () => []),
}));
vi.mock('./starterSeedService.js', () => ({
  loadStarterSeed: vi.fn(async () => null),
  saveStarterSeed: vi.fn(async () => ({})),
}));
const MONSTER_NAMES = [
  'Goblin', 'Kobold', 'Bandit', 'Skeleton', 'Zombie', 'Wolf', 'Orc',
  'Hobgoblin', 'Bugbear', 'Giant Spider',
];

function monsterRow(name) {
  return { name, index: name.toLowerCase(), armor_class: 12, hit_points: 7, speed: { walk: '30 ft.' } };
}

vi.mock('../ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(async () => MONSTER_NAMES.map(monsterRow)),
}));

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ message: 'created' }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ message: 'created' }) }));
  generateSettlement.mockImplementation(async () => ({
    name: 'Thornhollow',
    size: 'village',
    description: 'A quiet village.',
  }));
});

// ---------------------------------------------------------------------------
// helper unit
// ---------------------------------------------------------------------------
describe('withLeadingArticle', () => {
  it('leaves names already leading with an article word untouched (no "The The")', () => {
    expect(withLeadingArticle('The Quality Emporium')).toBe('The Quality Emporium');
    expect(withLeadingArticle('A Quiet Corner')).toBe('A Quiet Corner');
    expect(withLeadingArticle('An Open Door')).toBe('An Open Door');
  });

  it('adds the article when the name has none (template requires it)', () => {
    expect(withLeadingArticle('Quality Emporium')).toBe('The Quality Emporium');
    expect(withLeadingArticle('general store')).toBe('The general store');
  });

  it('is case-aware: only collapses the exact capitalized article WORDS, never mid-string or word-initial "the/a/an"', () => {
    expect(withLeadingArticle('Briar the Bold')).toBe('The Briar the Bold');
    expect(withLeadingArticle('Northern thegn Forge')).toBe('The Northern thegn Forge');
    expect(withLeadingArticle('Anthel\'s Arcana')).toBe('The Anthel\'s Arcana');
    // Lowercase/"SHOUTING" articles are not genuine article collisions — the
    // banks only ever ship "The "/"A "/"An ", so those names keep the prefix.
    expect(withLeadingArticle('the quality emporium')).toBe('The the quality emporium');
    expect(withLeadingArticle('THE Quality Emporium')).toBe('The THE Quality Emporium');
  });
});

// ---------------------------------------------------------------------------
// composer seam — STARTER_PRESET rumor assembly
// ---------------------------------------------------------------------------
describe('starter rumor composer', () => {
  const rumorForService = async (serviceName) => {
    generateSettlement.mockImplementation(async () => ({
      name: 'Thornhollow',
      size: 'village',
      description: 'A quiet village.',
      services: serviceName === null ? [] : [{ type: 'general_store', name: serviceName }],
      notableNPCs: [{ name: 'Riswynn', role: 'Shopkeeper' }],
      rumors: ['A merchant caravan went missing on the northern road three days ago.'],
    }));
    await createSeededCampaign('starter', { name: 'qa-starter', seed: 5 });
    const saved = saveSettlement.mock.calls[0][1];
    return saved.rumors.find(r => r.includes('hasn\'t had a caravan'));
  };

  it('renders "The Quality Emporium hasn\'t had a caravan…" — single leading article', async () => {
    const rumor = await rumorForService('The Quality Emporium');
    expect(rumor).toBe('The Quality Emporium hasn\'t had a caravan through since Hobgoblins took the old ruin.');
    expect(rumor).not.toMatch(/The The\b/);
  });

  it('still adds the article for a plain service name', async () => {
    const rumor = await rumorForService('Quality Emporium');
    expect(rumor).toMatch(/^The Quality Emporium hasn't had a caravan/);
  });

  it('leaves mid-string "the" names alone (article still prefixed)', async () => {
    const rumor = await rumorForService('Briar the Bold');
    expect(rumor).toMatch(/^The Briar the Bold hasn't had a caravan/);
  });

  it('keeps the no-services fallback byte-identical', async () => {
    const rumor = await rumorForService(null);
    expect(rumor).toMatch(/^The general store hasn't had a caravan/);
  });
});

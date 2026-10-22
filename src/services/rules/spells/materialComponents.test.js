// @maintained-by-ai
// materialComponents.js — behavior pin suite.
// Role in the component domain: name-keyed MATERIAL_REGISTRY (33 consumed-material
// spells, service-authored literals — NOT disk verbatim, see #1407 revivify precedent),
// the CLA-404 costly/consumed text detector consumed by blockChecks.js:17 (Beast
// Spells), and the single consumption chokepoint (consumeMaterial) used by
// revivifyService.js:37 ('Diamond (300 gp)'), useCustomHandlers.js:251
// ('Diamond Dust (100 gp)'), useAreaEffectHandlers.js:42 ('Ruby Dust (1,500 gp)'),
// useMetamagicHandler.js:64 and useSpellMetamagicGates.js:271/274/295 (registry itemName).
// Kill matrix (per test): G1 kills guard-removal TypeError; G2 kills any registry-row
// edit; G3 kills case/byte-normalization + registry-scope widening; K1 kills regex edits
// against disk literals; K2 kills non-string coercion + trimmed-fallback removal;
// H1 kills match-normalization + missing-backpack guard; C1 kills spend-before-refuse
// reorder; C2-C5 kill PATCH-body mutants; C6 kills metaKey lookup branches;
// C7 kills double-decrement; C8 kills refund-lie; C9 kills filename-sanitizer edit;
// M1 kills requirement-message guard; M2 kills suffix logic; M3 kills duplicate-suffix.
// No clocks: consumption is instantaneous; the only Date.now() is log metadata, stubbed.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mockSetRuntimeValue = vi.fn();
const mockAddEntry = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: (...args) => mockSetRuntimeValue(...args),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: (...args) => mockAddEntry(...args),
}));

const {
  getConsumedMaterial,
  spellHasCostlyOrConsumedMaterial,
  hasMaterial,
  consumeMaterial,
  getMaterialRequirementMessage,
} = await import('./materialComponents.js');

const FIXED_TS = 1700000000000;
let fetchMock;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('') });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_TS);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Full MATERIAL_REGISTRY pin: [spell name, itemName, required] transcribed byte-exact
// from materialComponents.js. itemName literals are the backpack match/consume keys
// live callers pass to consumeMaterial.
const REGISTRY_ROWS = [
  ['Animate Dead', 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust', 'a drop of blood, a piece of flesh, and a pinch of bone dust'],
  ['Create Undead', 'Black Onyx (150 gp)', 'one 150+ GP black onyx stone for each corpse'],
  ['Arcane Lock', 'Gold Dust (25 gp)', 'gold dust worth 25+ GP, which the spell consumes'],
  ['Astral Projection', 'Jacinth (1,000 gp)', 'jacinth and silver bar, all of which the spell consumes'],
  ['Awaken', 'Agate (1,000 gp)', 'an agate worth 1,000+ GP, which the spell consumes'],
  ['Clone', 'Diamond (1,000 gp)', 'a diamond worth 1,000+ GP, which the spell consumes'],
  ['Continual Flame', 'Ruby Dust (50 gp)', 'ruby dust worth 50+ GP, which the spell consumes'],
  ['Divination', 'Incense (25 gp)', 'incense worth 25+ GP, which the spell consumes'],
  ['Find Familiar', 'Incense (10 gp)', 'burning incense worth 10+ GP, which the spell consumes'],
  ['Forcecage', 'Ruby Dust (1,500 gp)', 'ruby dust worth 1,500+ GP, which the spell consumes'],
  ['Gentle Repose', 'Copper Piece (2 gp)', '2 Copper Pieces, which the spell consumes'],
  ['Glyph of Warding', 'Powdered Diamond (200 gp)', 'powdered diamond worth 200+ GP, which the spell consumes'],
  ['Greater Restoration', 'Diamond Dust (100 gp)', 'diamond dust worth 100+ GP, which the spell consumes'],
  ['Hallow', 'Incense (1,000 gp)', 'incense worth 1,000+ GP, which the spell consumes'],
  ["Heroes' Feast", 'Gem-Encrusted Bowl (1,000 gp)', 'a gem-encrusted bowl worth 1,000+ GP, which the spell consumes'],
  ['Illusory Script', 'Ink (10 gp)', 'ink worth 10+ GP, which the spell consumes'],
  ['Legend Lore', 'Incense (250 gp)', 'incense worth 250+ GP, which the spell consumes'],
  ['Magic Circle', 'Salt and Powdered Silver (100 gp)', 'salt and powdered silver worth 100+ GP, which the spell consumes'],
  ['Magic Mouth', 'Jade Dust (10 gp)', 'jade dust worth 10+ GP, which the spell consumes'],
  ['Nondetection', 'Diamond Dust (25 gp)', 'a pinch of diamond dust worth 25+ GP, which the spell consumes'],
  ['Planar Binding', 'Jewel (1,000 gp)', 'a jewel worth 1,000+ GP, which the spell consumes'],
  ['Protection from Evil and Good', 'Flask of Holy Water (25 gp)', 'a flask of Holy Water worth 25+ GP, which the spell consumes'],
  ['Raise Dead', 'Diamond (500 gp)', 'a diamond worth 500+ GP, which the spell consumes'],
  ['Reincarnate', 'Rare Oils (1,000 gp)', 'rare oils worth 1,000+ GP, which the spell consumes'],
  ['Resurrection', 'Diamond (1,000 gp)', 'a diamond worth 1,000+ GP, which the spell consumes'],
  ['Revivify', 'Diamond (300 gp)', 'a diamond worth 300+ GP, which the spell consumes'],
  ['Sequester', 'Gem Dust (5,000 gp)', 'gem dust worth 5,000+ GP, which the spell consumes'],
  ['Simulacrum', 'Powdered Ruby (1,500 gp)', 'powdered ruby worth 1,500+ GP, which the spell consumes'],
  ['Stone Skin', 'Diamond Dust (100 gp)', 'diamond dust worth 100+ GP, which the spell consumes'],
  ['Symbol', 'Powdered Diamond (1,000 gp)', 'powdered diamond worth 1,000+ GP, which the spell consumes'],
  ['Teleportation Circle', 'Rare Inks (50 gp)', 'rare inks worth 50+ GP, which the spell consumes'],
  ['True Resurrection', 'Diamond (25,000 gp)', 'diamonds worth 25,000+ GP, which the spell consumes'],
  ['True Seeing', 'Mushroom Powder (25 gp)', 'mushroom powder worth 25+ GP, which the spell consumes'],
];

const spells5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/spells.json'), 'utf8'));
const spells2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));
const diskRow = (list, name) => list.find(s => s && s.name === name);

describe('getConsumedMaterial — exact-name registry lookup', () => {
  it('#213 DISK PARITY: both disk-canonical Stone Skin rows exist, both carry consumed-diamond-dust material text, and both names resolve to the SAME registry row bytes', () => {
    const row5e = diskRow(spells5e, 'Stoneskin');   // 5e canonical (spells.json:9430)
    const row2024 = diskRow(spells2024, 'Stone Skin'); // 2024 canonical (2024/spells.json:12509)
    expect(row5e).toBeTruthy();
    expect(row2024).toBeTruthy();
    expect(/consumes/i.test(row5e.material)).toBe(true);
    expect(/consumes/i.test(row2024.material)).toBe(true);
    expect(getConsumedMaterial(row5e)).toEqual(getConsumedMaterial(row2024));
  });

  it('returns null for missing spell and nameless spell', () => {
    expect(getConsumedMaterial(null)).toBeNull();
    expect(getConsumedMaterial(undefined)).toBeNull();
    expect(getConsumedMaterial({})).toBeNull();
    expect(getConsumedMaterial({ name: '' })).toBeNull();
  });

  it('returns the exact {itemName, required} row for every one of the 33 registered spells', () => {
    for (const [name, itemName, required] of REGISTRY_ROWS) {
      expect(getConsumedMaterial({ name })).toEqual({ itemName, required });
    }
  });

  it('misses unregistered real spells, case variants, and curly-apostrophe spell names — but folds the two disk-canonical spellings of Stone Skin to ONE row (#213)', () => {
    // Identify is costly on disk but deliberately outside this backpack-gating registry.
    expect(getConsumedMaterial(diskRow(spells5e, 'Identify'))).toBeNull();
    // #213 canonical-name census: 'Stone Skin' is 2024 disk-canonical (2024/spells.json:12509),
    // 'Stoneskin' is 5e disk-canonical (spells.json:9430). PRE-FIX this 5e variant NEVER
    // matched the registry (null — losing variant, alias-space divergence). The exact-match
    // DISK_CANONICAL_NAME_ALIASES edge at materialComponents.js now folds it onto the
    // single 'Stone Skin' row; both consumers (blockChecks Beast Spells, metamagic gates)
    // resolve either disk spelling to the same bytes.
    expect(getConsumedMaterial(diskRow(spells5e, 'Stoneskin'))).toEqual({ itemName: 'Diamond Dust (100 gp)', required: 'diamond dust worth 100+ GP, which the spell consumes' });
    expect(getConsumedMaterial(diskRow(spells2024, 'Stone Skin'))).toEqual({ itemName: 'Diamond Dust (100 gp)', required: 'diamond dust worth 100+ GP, which the spell consumes' });
    expect(getConsumedMaterial({ name: 'Not A Spell' })).toBeNull();
    expect(getConsumedMaterial({ name: 'revivify' })).toBeNull();
    expect(getConsumedMaterial({ name: 'REVIVIFY' })).toBeNull();
    // Fold is name-identity, NOT case/space normalization: lowercase 'stoneskin' and
    // 'Stone Skin' case-mutants must still miss (H1 kill intact).
    expect(getConsumedMaterial({ name: 'stoneskin' })).toBeNull();
    expect(getConsumedMaterial({ name: 'STONE SKIN' })).toBeNull();
    // Registry key carries U+0027 (verified bytewise); U+2019 must NOT match.
    expect(getConsumedMaterial({ name: 'Heroes\u2019 Feast' })).toBeNull();
  });
});

describe('spellHasCostlyOrConsumedMaterial — CLA-404 cost/consumption detector (blockChecks.js Beast Spells lane)', () => {
  it('classifies REAL disk material rows from both rulesets', () => {
    // [disk spell, verbatim material pin (drift detector), expected]
    const rows = [
      ['5e', diskRow(spells5e, 'Revivify'), 'Diamonds worth 300gp, which the spell consumes.', true],
      ['2024', diskRow(spells2024, 'Revivify'), 'a diamond worth 300+ GP, which the spell consumes', true],
      // Costly but NOT consumed — only the 'worth' clause makes these true.
      ['5e', diskRow(spells5e, 'Identify'), 'A pearl worth at least 100gp and an owl feather.', true],
      ['2024', diskRow(spells2024, 'Identify'), 'a pearl worth 100+ GP', true],
      // No gp/worth/consumes in text — carried solely by the registry fallback.
      ['5e', diskRow(spells5e, 'Animate Dead'), 'A drop of blood, a piece of flesh, and a pinch of bone dust.', true],
      // Free materials, unregistered: the ALLOW side of the Beast Spells bypass.
      ['5e', diskRow(spells5e, 'Aid'), 'A tiny strip of white cloth.', false],
      ['2024', diskRow(spells2024, 'Aid'), 'a strip of white cloth', false],
    ];
    for (const [ruleset, spell, material, expected] of rows) {
      expect(ruleset === '5e' || ruleset === '2024').toBe(true);
      expect((spell || {}).material).toBe(material);
      expect(spellHasCostlyOrConsumedMaterial(spell)).toBe(expected);
    }
  });

  it('treats trimmed refs via registry fallback, ignores non-string material, false for falsy spell', () => {
    expect(spellHasCostlyOrConsumedMaterial(null)).toBe(false);
    expect(spellHasCostlyOrConsumedMaterial(undefined)).toBe(false);
    expect(spellHasCostlyOrConsumedMaterial({})).toBe(false);
    expect(spellHasCostlyOrConsumedMaterial({ name: 'Raise Dead' })).toBe(true);
    // Registry scope pin: Identify is costly on disk but absent from the registry.
    expect(spellHasCostlyOrConsumedMaterial({ name: 'Identify' })).toBe(false);
    expect(spellHasCostlyOrConsumedMaterial({ name: 'Fireball', material: 500 })).toBe(false);
  });
});

describe('hasMaterial — exact-name backpack match', () => {
  it('matches string and object rows byte-exactly; misses case, substring, absent, and missing inventory', () => {
    const stats = {
      name: 'Test Character',
      inventory: { backpack: ['Diamond (300 gp)', { name: 'Incense (10 gp)' }, {}] },
    };
    expect(hasMaterial(stats, 'Diamond (300 gp)')).toBe(true);
    expect(hasMaterial(stats, 'Incense (10 gp)')).toBe(true);
    expect(hasMaterial(stats, 'diamond (300 gp)')).toBe(false);
    expect(hasMaterial(stats, 'Incense')).toBe(false);
    expect(hasMaterial(stats, 'Rations')).toBe(false);
    expect(hasMaterial({ name: 'Test Character', inventory: {} }, 'Diamond (300 gp)')).toBe(false);
    expect(hasMaterial({ name: 'Test Character' }, 'Diamond (300 gp)')).toBe(false);
    // Quirk pin (unguarded, golden): nullish playerStats derefs straight through.
    expect(() => hasMaterial(undefined, 'Diamond (300 gp)')).toThrow(TypeError);
    // Quirk pin: empty itemName matches a nameless backpack row.
    expect(hasMaterial({ name: 'Test Character', inventory: { backpack: [{}] } }, '')).toBe(true);
  });
});

describe('consumeMaterial — refuse-before-spend, PATCH body, runtime tuple, campaign log', () => {
  it('refuses before spending anything when the item is not carried', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stats = { name: 'Test Character', inventory: { backpack: ['Rations'] } };
    const before = JSON.stringify(stats);

    const result = await consumeMaterial(stats, 'Diamond (300 gp)', 'test-campaign');

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockSetRuntimeValue).not.toHaveBeenCalled();
    expect(mockAddEntry).not.toHaveBeenCalled();
    expect(consoleSpy.mock.calls).toEqual([
      ['[materialComponents] No Diamond (300 gp) found in backpack for Test Character'],
    ]);
    expect(JSON.stringify(stats)).toBe(before);
  });

  it('consumes a string item: full PATCH, arity-4 runtime tuple, exact log entry, input untouched', async () => {
    const stats = { name: 'Test Character', inventory: { backpack: ['Diamond (300 gp)', 'Rations'] } };
    const before = JSON.stringify(stats);

    const result = await consumeMaterial(stats, 'Diamond (300 gp)', 'test-campaign');

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/campaigns/test-campaign/Test_Character.json');
    expect(init.method).toBe('PATCH');
    expect(init.mode).toBe('cors');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    // No fabricated keys: inventory had no itemMeta, so none may appear in the PATCH.
    expect(JSON.parse(init.body)).toEqual({ inventory: { backpack: ['Rations'] } });
    expect(mockSetRuntimeValue.mock.calls).toEqual([
      ['Test Character', 'inventory', { backpack: ['Rations'] }, 'test-campaign'],
    ]);
    expect(mockAddEntry.mock.calls).toEqual([[
      'test-campaign',
      { type: 'material_consumed', characterName: 'Test Character', material: 'Diamond (300 gp)', timestamp: FIXED_TS },
    ]]);
    expect(JSON.stringify(stats)).toBe(before);
  });

  it('splices the matched object row and keeps the surviving object by identity', async () => {
    const survivor = { name: 'Rations' };
    const stats = { name: 'Test Character', inventory: { backpack: [{ name: 'Diamond (300 gp)' }, survivor] } };

    const result = await consumeMaterial(stats, 'Diamond (300 gp)', 'test-campaign');

    expect(result).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ inventory: { backpack: [{ name: 'Rations' }] } });
    // Survivor object passes through by reference — no clone, no rebuild.
    expect(mockSetRuntimeValue.mock.calls[0][2].backpack[0]).toBe(survivor);
  });

  it('decrements itemMeta quantity and keeps the backpack string when more remain', async () => {
    const stats = {
      name: 'Test Character',
      inventory: {
        backpack: ['Diamond Dust (100 gp)', 'Rations'],
        itemMeta: { 'Diamond Dust (100 gp)': { quantity: 3, description: 'ground' } },
      },
    };
    const before = JSON.stringify(stats);

    const result = await consumeMaterial(stats, 'Diamond Dust (100 gp)', 'test-campaign');

    expect(result).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      inventory: {
        backpack: ['Diamond Dust (100 gp)', 'Rations'],
        itemMeta: { 'Diamond Dust (100 gp)': { quantity: 2, description: 'ground' } },
      },
    });
    expect(JSON.stringify(stats)).toBe(before);
  });

  it('removes the string and zeroes itemMeta quantity on the last one (PATCH deep-merge survivable)', async () => {
    const stats = {
      name: 'Test Character',
      inventory: {
        backpack: ['Diamond Dust (100 gp)', 'Rations'],
        itemMeta: { 'Diamond Dust (100 gp)': { quantity: 1 } },
      },
    };

    const result = await consumeMaterial(stats, 'Diamond Dust (100 gp)', 'test-campaign');

    expect(result).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      inventory: {
        backpack: ['Rations'],
        itemMeta: { 'Diamond Dust (100 gp)': { quantity: 0 } },
      },
    });
  });

  it('resolves itemMeta keys case-insensitively (writing back the original key) and stamps nothing when meta is empty', async () => {
    const cases = [
      [
        { name: 'Test Character', inventory: { backpack: ['Incense (10 gp)'], itemMeta: { 'incense (10 gp)': { quantity: 1, notes: 'sticks' } } } },
        { inventory: { backpack: [], itemMeta: { 'incense (10 gp)': { quantity: 0, notes: 'sticks' } } } },
      ],
      [
        { name: 'Test Character', inventory: { backpack: ['Incense (10 gp)'], itemMeta: {} } },
        { inventory: { backpack: [], itemMeta: {} } },
      ],
    ];

    for (let i = 0; i < cases.length; i++) {
      const [stats, expectedBody] = cases[i];
      const result = await consumeMaterial(stats, 'Incense (10 gp)', 'test-campaign');
      expect(result).toBe(true);
      expect(JSON.parse(fetchMock.mock.calls[i][1].body)).toEqual(expectedBody);
    }
    expect(mockSetRuntimeValue).toHaveBeenCalledTimes(2);
  });

  it('composes two spends 2->1->0 without double-decrement or auto-refund', async () => {
    const stats = {
      name: 'Test Character',
      inventory: {
        backpack: ['Diamond (300 gp)', 'Rations'],
        itemMeta: { 'Diamond (300 gp)': { quantity: 2 } },
      },
    };

    expect(await consumeMaterial(stats, 'Diamond (300 gp)', 'test-campaign')).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      inventory: { backpack: ['Diamond (300 gp)', 'Rations'], itemMeta: { 'Diamond (300 gp)': { quantity: 1 } } },
    });

    // Second cast pays against the PATCHed inventory, exactly as callers re-read it.
    const stats2 = { name: 'Test Character', inventory: JSON.parse(fetchMock.mock.calls[0][1].body).inventory };
    expect(await consumeMaterial(stats2, 'Diamond (300 gp)', 'test-campaign')).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      inventory: { backpack: ['Rations'], itemMeta: { 'Diamond (300 gp)': { quantity: 0 } } },
    });
  });

  it('PATCH failure and log failure are honest: consumed stands, both errors surface, nothing refunds', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('Server error') });
    mockAddEntry.mockRejectedValueOnce(new Error('Log error'));
    const stats = { name: 'Test Character', inventory: { backpack: ['Diamond (300 gp)'] } };

    const result = await consumeMaterial(stats, 'Diamond (300 gp)', 'test-campaign');

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockSetRuntimeValue.mock.calls).toEqual([
      ['Test Character', 'inventory', { backpack: [] }, 'test-campaign'],
    ]);
    expect(consoleSpy.mock.calls).toHaveLength(2);
    expect(consoleSpy.mock.calls[0]).toEqual(['[materialComponents] PATCH error body: Server error']);
    expect(consoleSpy.mock.calls[1][0]).toBe('[materialComponents] Error logging material consumption:');
    expect(consoleSpy.mock.calls[1][1] instanceof Error).toBe(true);
    expect(consoleSpy.mock.calls[1][1].message).toBe('Log error');
  });

  it('sanitizes the character name into the JSON filename byte-exactly', async () => {
    const stats = { name: 'Char @ # $ %', inventory: { backpack: ['Diamond (300 gp)'] } };

    expect(await consumeMaterial(stats, 'Diamond (300 gp)', 'test-campaign')).toBe(true);

    expect(fetchMock.mock.calls[0][0]).toBe('/api/campaigns/test-campaign/Char________.json');
    expect(mockSetRuntimeValue.mock.calls).toEqual([
      ['Char @ # $ %', 'inventory', { backpack: [] }, 'test-campaign'],
    ]);
  });
});

describe('getMaterialRequirementMessage — requirement text builder', () => {
  it('returns null for spells without a registry row', () => {
    expect(getMaterialRequirementMessage(null)).toBeNull();
    expect(getMaterialRequirementMessage({})).toBeNull();
    expect(getMaterialRequirementMessage(diskRow(spells5e, 'Fireball'))).toBeNull();
  });

  it('formats exact messages for the consume-suffix present and absent classes', () => {
    // Class A: registry text already says 'which the spell consumes' — only '.' appended.
    expect(getMaterialRequirementMessage({ name: 'Revivify' }))
      .toBe('Revivify requires a diamond worth 300+ GP, which the spell consumes.');
    // Class A byte fidelity: apostrophe is U+0027 in key and message alike.
    expect(getMaterialRequirementMessage({ name: "Heroes' Feast" }))
      .toBe("Heroes' Feast requires a gem-encrusted bowl worth 1,000+ GP, which the spell consumes.");
    // Class B: raw text does not consume, but the message appends the clause (quirk pin).
    expect(getMaterialRequirementMessage({ name: 'Animate Dead' }))
      .toBe('Animate Dead requires a drop of blood, a piece of flesh, and a pinch of bone dust, which the spell consumes.');
    expect(getMaterialRequirementMessage({ name: 'Create Undead' }))
      .toBe('Create Undead requires one 150+ GP black onyx stone for each corpse, which the spell consumes.');
  });

  it('every registry row renders exactly one "which the spell consumes" clause', () => {
    for (const [name] of REGISTRY_ROWS) {
      const message = getMaterialRequirementMessage({ name });
      expect(message.startsWith(`${name} requires `)).toBe(true);
      expect(message.match(/which the spell consumes/g)).toHaveLength(1);
    }
  });
});

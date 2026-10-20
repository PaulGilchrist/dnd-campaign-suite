// @maintained-by-ai
// Lane: npcCombatService.addNPCToInitiative — sole owner of NPC-initiative assembly
// (source read in full: hard gate → dup check → weapon prompt → roll → push → sort →
// storage.set → event → log fetch → callback).
//
// Cited, never re-driven here:
//   npcStatBlockUtils gates are inputs — predicate internals owned by
//     npcStatBlockUtils.test.js (its header disclaims initiative assembly).
//   initiativeService CANON #1079 owns the PC-side rollD20 seam; this file mocks
//     rollD20 only to pin NPC-side bonus arithmetic determinism.
//   combatData #1074 owns loadCombatSummary; here it is a canned transport stub.
//   Store-faithful campaign-keyed tuple #932/#1019 — storage.set('combatSummary', …, campaign)
//     pinned once below; refusals zero-write census #1026/#1095 inline per branch.
//   RNG consumed-in-order #1076: rollD20 consumed exactly once, after all refusal gates.
//   Log exact payload #app mandate; coercion/zero-is-data #945/#950; it.each #903;
//     seams never wall-clock (setTimeout below is a microtask flush only).
//
// Consumers (components/npcs/NPCs.test.jsx, sessions/Sessions.test.jsx) mock this
// service — they cover wiring only, no behavior duplicated there.
//
// Old → new map:
//   hard-gate ×2 → 1 refuse census; "asks" + "adds anyway" → weapon-cancel;
//   summary-init default → folded into default-bytes; "preserves" + "sorts" → preserve-sort-append;
//   dup "different names" → removed (baseline covered by every happy path);
//   initiative pos/neg/invalid loop → it.each table (loop read stale calls[0]);
//   creature-fields ×6 → exact-bytes ×2 + image-fallback;
//   transport + event → 1; log ×3 → it.each exact-payload ×3 (adds nat20/nat1);
//   resilience → real rejection + console.flush (old mock pre-swallowed its own error).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { npcHasStatBlock, npcHasAttacks } from '../encounters/npcStatBlockUtils.js';
import { rollD20 } from '../dice/diceRoller.js';
import { loadCombatSummary } from '../encounters/combatData.js';
import storage from '../ui/storage.js';
import { addNPCToInitiative } from './npcCombatService.js';

vi.mock('../encounters/npcStatBlockUtils.js', () => ({
  npcHasStatBlock: vi.fn(),
  npcHasAttacks: vi.fn(),
}));

vi.mock('../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15),
}));

vi.mock('../encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../ui/utils.js', () => ({
  default: { guid: vi.fn(() => 'test-guid') },
}));

const CAMPAIGN = 'testCampaign';
const LOG_URL = `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/log`;

const defaultNPC = () => ({ name: 'Goblin', armorClass: 12, hitPoints: 7 });
const withAttack = (npc) => ({
  ...npc,
  actions: [{ name: 'Scimitar', attack_bonus: '+4', damage_dice_primary: '1d6', damage_type_primary: 'slashing' }],
});

describe('npcCombatService - addNPCToInitiative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    npcHasStatBlock.mockReturnValue(true);
    npcHasAttacks.mockReturnValue(true);
    rollD20.mockReturnValue(15);
    loadCombatSummary.mockResolvedValue(null);
    storage.set.mockImplementation(() => Promise.resolve());
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
    // Default: GM declines the weapon prompt and lets the NPC join anyway.
    vi.spyOn(window, 'confirm').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an NPC lacking AC/HP: throws, zero reads, rolls, prompts, writes, or callbacks', async () => {
    npcHasStatBlock.mockReturnValue(false);
    const callback = vi.fn();

    await expect(addNPCToInitiative(CAMPAIGN, defaultNPC(), callback)).rejects.toThrow(/needs AC and HP/);

    expect(loadCombatSummary).not.toHaveBeenCalled();
    expect(rollD20).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  describe('weapon prompt when the NPC has no attacks', () => {
    it('prompts, then adds (unarmed fallback) and fires onViewInitiative when the GM cancels', async () => {
      npcHasAttacks.mockReturnValue(false);
      const callback = vi.fn();

      const result = await addNPCToInitiative(CAMPAIGN, defaultNPC(), callback);

      expect(window.confirm).toHaveBeenCalledTimes(1);
      expect(window.confirm.mock.calls[0][0]).toMatch(/no weapons or attacks/i);
      expect(result).toBe('added');
      expect(storage.set).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('returns needs-weapon with a zero-write census when the GM opts to provide a weapon', async () => {
      npcHasAttacks.mockReturnValue(false);
      window.confirm.mockReturnValue(true);
      const callback = vi.fn();

      const result = await addNPCToInitiative(CAMPAIGN, defaultNPC(), callback);

      expect(result).toBe('needs-weapon');
      expect(rollD20).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
    });

    it('does not prompt when the NPC has a usable attack', async () => {
      const result = await addNPCToInitiative(CAMPAIGN, withAttack(defaultNPC()));

      expect(result).toBe('added');
      expect(window.confirm).not.toHaveBeenCalled();
    });
  });

  describe('duplicate NPC check', () => {
    it('returns already with a zero-write census and no roll or prompt when an npc of that name is in initiative', async () => {
      npcHasAttacks.mockReturnValue(false);
      loadCombatSummary.mockResolvedValue({ round: 1, creatures: [{ type: 'npc', name: 'Goblin' }] });
      const callback = vi.fn();

      const result = await addNPCToInitiative(CAMPAIGN, defaultNPC(), callback);

      expect(result).toBe('already');
      expect(callback).toHaveBeenCalledTimes(1);
      expect(rollD20).not.toHaveBeenCalled();
      expect(window.confirm).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('adds an NPC whose name matches only a pc creature', async () => {
      loadCombatSummary.mockResolvedValue({ round: 1, creatures: [{ type: 'pc', name: 'Goblin' }] });

      const result = await addNPCToInitiative(CAMPAIGN, defaultNPC());

      expect(result).toBe('added');
      const saved = storage.set.mock.calls[0][1];
      expect(saved.creatures.map((c) => c.name)).toEqual(['Goblin', 'Goblin']);
      expect(saved.creatures.filter((c) => c.type === 'npc')).toHaveLength(1);
    });
  });

  // initiativeBonus coercion truth table (rollD20 stubbed at 15). undefined-absent
  // is exercised by every other test; zero is data #945/#950.
  it.each([
    ['+3', '18', 3],
    ['-2', '13', -2],
    [2, '17', 2],
    [0, '15', 0],
    ['invalid', '15', 0],
    [null, '15', 0],
  ])('initiativeBonus %s joins as initiative %s (parsed %s)', async (bonus, initiative, parsed) => {
    await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: bonus });

    const creature = storage.set.mock.calls[0][1].creatures[0];
    expect(creature.initiative).toBe(initiative);
    expect(creature.initiativeBonus).toBe(parsed);
  });

  describe('creature record', () => {
    it('pushes an exact minimal npc creature and starts a fresh round-1 summary', async () => {
      const result = await addNPCToInitiative(CAMPAIGN, defaultNPC());

      expect(result).toBe('added');
      const saved = storage.set.mock.calls[0][1];
      expect(saved.round).toBe(1);
      expect(saved.creatures).toEqual([
        {
          name: 'Goblin',
          type: 'npc',
          monsterType: undefined,
          initiative: '15',
          targetName: null,
          ac: 12,
          resistances: [],
          immunities: [],
          concentration: null,
          imagePath: '',
          initiativeBonus: 0,
          maxHp: 7,
          currentHp: 7,
          saveBonuses: {},
        },
      ]);
    });

    it('copies rich NPC fields verbatim — string HP coerced once, imagePath wins over image', async () => {
      await addNPCToInitiative(CAMPAIGN, {
        name: 'Goblin',
        type: 'humanoid',
        armorClass: 15,
        hitPoints: '18',
        initiativeBonus: '+2',
        damageResistances: ['fire', 'cold'],
        damageImmunities: ['poison'],
        imagePath: '/images/goblin.jpg',
        image: '/stale/goblin.png',
      });

      expect(storage.set.mock.calls[0][1].creatures[0]).toEqual({
        name: 'Goblin',
        type: 'npc',
        monsterType: 'humanoid',
        initiative: '17',
        targetName: null,
        ac: 15,
        resistances: ['fire', 'cold'],
        immunities: ['poison'],
        concentration: null,
        imagePath: '/images/goblin.jpg',
        initiativeBonus: 2,
        maxHp: 18,
        currentHp: 18,
        saveBonuses: {},
      });
    });

    it('falls back to image when imagePath is absent', async () => {
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), image: '/images/goblin.png' });

      expect(storage.set.mock.calls[0][1].creatures[0].imagePath).toBe('/images/goblin.png');
    });
  });

  it('preserves round and existing creatures, then sorts the whole field descending', async () => {
    loadCombatSummary.mockResolvedValue({
      round: 5,
      creatures: [
        { type: 'npc', name: 'Orc', initiative: '20' },
        { type: 'pc', name: 'Hero', initiative: '15' },
      ],
    });
    rollD20.mockReturnValue(8);

    const result = await addNPCToInitiative(CAMPAIGN, defaultNPC());

    expect(result).toBe('added');
    const saved = storage.set.mock.calls[0][1];
    expect(saved.round).toBe(5);
    expect(saved.creatures.map((c) => c.name)).toEqual(['Orc', 'Hero', 'Goblin']);
    expect(saved.creatures[1]).toEqual({ type: 'pc', name: 'Hero', initiative: '15' });
    expect(saved.creatures[2].initiative).toBe('8');
  });

  it('persists under the campaign-keyed combatSummary tuple and dispatches initiative-rolled', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    await addNPCToInitiative(CAMPAIGN, defaultNPC());

    expect(storage.set).toHaveBeenCalledWith(
      'combatSummary',
      expect.objectContaining({ round: expect.any(Number), creatures: expect.any(Array) }),
      CAMPAIGN
    );
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'initiative-rolled' })
    );
  });

  // Exact log payload #app mandate — full-body toEqual per natural-roll row.
  // total is the raw die (bonus is carried separately by design).
  it.each([
    [20, true, false],
    [1, false, true],
    [14, false, false],
  ])('logs a natural %s roll with an exact payload', async (die, isNat20, isNat1) => {
    rollD20.mockReturnValue(die);

    await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: '+3' });

    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(LOG_URL);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      type: 'roll',
      characterName: 'Goblin',
      rollType: 'initiative',
      name: 'Initiative',
      rolls: [die],
      total: die,
      bonus: 3,
      mode: 'normal',
      isNatural20: isNat20,
      isNatural1: isNat1,
      timestamp: expect.any(Number),
      id: 'test-guid',
    });
  });

  it('still adds and persists when the log fetch rejects', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn(() => Promise.reject(new Error('network error')));

    await expect(addNPCToInitiative(CAMPAIGN, defaultNPC())).resolves.toBe('added');
    expect(storage.set).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});

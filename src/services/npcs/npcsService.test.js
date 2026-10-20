// @maintained-by-ai
// Lane: npcsService.js — the ONLY verifier of /api/campaigns/:c/npcs CRUD transport (exact-if-fetch #1010).
// Split (owner #1180): npcGenerator.test.js owns /data/* transport; npcFormUtils.test.js owns form
// defaults (#1179); npcCombatService.test.js owns initiative (#1178); consumers mock this module.
// Every fetch pins method+URL+body bytes; every mock loud-decoys on extra calls (#1166).
// Server-envelope citations (real bytes BY NAME from server/routes/npcs.js + server/utils/jsonEntityCrud.js):
//   PUT    /npcs/:name  200 { success:true, npc } npcs.js:126 | 400 guard npcs.js:112, msg template npcs.js:34
//   GET    /npcs        200 { npcs:[...] } jsonEntityCrud.js:49 (responseWrapper — NOT a bare array)
//   POST   /npcs        200 { success:true } :74 | 400 { error:'Expected an array for npcs' } :62
//                       | 400 validateList npcs.js:44 (bestiary guard, same :34 template)
//   GET    /npcs/:id    200 { npc:{...} } :104 (itemWrapper) | 404 { error:'NPC not found' } :89/:97
//   DELETE /npcs/:id    200 { success:true } :133 | 404 { error:'NPC not found' } :119 (missing file)
// CUSTOM-NPC invariant (@app MANDATORY): npcs.json is custom-only; the client lane surfaces the
// server's plain-English bestiary 400 verbatim and never retries — pinned in the guard lane.
// Pass-through honesty: loadNPCs/loadNPC resolve the FULL wrapped envelope (consumers unpack
// .npcs/.npc at Initiative.jsx:255, Sessions.jsx:217, NPCs.jsx:132) — pinned here, not unwrapped.
// Old->new map (20 old -> 14 new): all transport pins kept, strengthened with real envelopes
// (old bare-array / bare-{name} / {success,savedCount} fakes were shapes the real server never sends);
// rename+encoding rows folded into transport table (%20 campaign+name, %26 special char);
// 'empty list' + per-endpoint 'encode' + 10 error/network units consolidated into the
// error table + one propagated-rejection test; generic-fallback folded per row (#959).
// No wall-clock (#app): zero timers. Source console.error in catches silenced, not asserted (#app).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadNPCs, saveNPCs, loadNPC, deleteNPC, saveNPC } from './npcsService.js';

// ─── Fixtures (real shapes: cleanNPCData output, npcFormUtils.js:53) ──────

const CUSTOM_NPC = {
  name: 'Bram Ironhand', race: 'Dwarf', classRole: 'Warrior', attitude: 'Friendly',
  appearance: 'Stocky', personality: 'Brave', goals: 'Wealth', secrets: 'None',
  tags: 'smith', notes: '', armorClass: 16, hitPoints: '20', hitDice: '',
  speed: { walk: '25 ft.' }, imagePath: '',
};

// npcs.js:34 verbatim template — the bestiary-guard 400 plain-English byte.
const bestiaryError = (name) => `"${name}" is a published monster — monsters join through the Encounter Builder with their real stat block. NPCs are for custom characters with their own name.`;

// ─── Helpers ────────────────────────────────────────────────────────────────

const CT = { 'Content-Type': 'application/json' };

// Mock consumed-in-order; extra calls throw loudly (decoy — no silent over-fetch, #1166).
function fetchQueue(...responses) {
  const mock = vi.fn(() => {
    throw new Error('UNEXPECTED extra fetch — more transport calls than pinned');
  });
  responses.forEach((r) => mock.mockResolvedValueOnce(r));
  return mock;
}

const ok = (body) => ({ ok: true, json: async () => body });
const err = (body) => ({ ok: false, json: async () => body });

beforeEach(() => {
  // Source console.errors in every catch — silenced diagnostics, messages pinned via re-throws (#app).
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Intact-state teardown (#1007/#1161): unstubAllGlobals also clears the fetch stub
  // (restoreAllMocks alone leaks the global fetch override — fixed here).
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('exact fetch transport + real server envelopes', () => {
  it.each([
    {
      label: 'saveNPC: PUT full URL bytes, resolves wrapped PUT envelope',
      invoke: (c) => saveNPC(c, CUSTOM_NPC),
      url: '/api/campaigns/test-campaign/npcs/Bram%20Ironhand',
      opts: { method: 'PUT', headers: CT, body: JSON.stringify(CUSTOM_NPC) },
      envelope: { success: true, npc: CUSTOM_NPC }, // npcs.js:126
    },
    {
      label: 'saveNPC rename: URL pins oldName, body byte-pins newName, %20/%26 encoded',
      invoke: (c) => saveNPC(c, { ...CUSTOM_NPC, name: 'Bram & Sons' }, 'Bram Ironhand'),
      url: '/api/campaigns/test-campaign/npcs/Bram%20Ironhand',
      opts: { method: 'PUT', headers: CT, body: JSON.stringify({ ...CUSTOM_NPC, name: 'Bram & Sons' }) },
      envelope: { success: true, npc: { ...CUSTOM_NPC, name: 'Bram & Sons' } },
    },
    {
      label: 'loadNPCs: GET collection, resolves WRAPPED { npcs:[...] } (jsonEntityCrud.js:49)',
      invoke: (c) => loadNPCs(c),
      url: '/api/campaigns/test-campaign/npcs',
      opts: { method: 'GET', headers: CT },
      envelope: { npcs: [CUSTOM_NPC] },
    },
    {
      label: 'saveNPCs: POST exact { npcs } body bytes, resolves { success:true } (:74)',
      invoke: (c) => saveNPCs(c, [CUSTOM_NPC]),
      url: '/api/campaigns/test-campaign/npcs',
      opts: { method: 'POST', headers: CT, body: JSON.stringify({ npcs: [CUSTOM_NPC] }) },
      envelope: { success: true },
    },
    {
      label: 'loadNPC: GET one, resolves WRAPPED { npc:{...} } (:104)',
      invoke: (c) => loadNPC(c, 'Bram Ironhand'),
      url: '/api/campaigns/test-campaign/npcs/Bram%20Ironhand',
      opts: { method: 'GET', headers: CT },
      envelope: { npc: CUSTOM_NPC },
    },
    {
      label: 'deleteNPC: DELETE exact opts — no headers, no body (:79-80)',
      invoke: (c) => deleteNPC(c, 'Bram Ironhand'),
      url: '/api/campaigns/test-campaign/npcs/Bram%20Ironhand',
      opts: { method: 'DELETE' },
      envelope: { success: true }, // :133
    },
  ])('$label', async ({ invoke, url, opts, envelope }) => {
    const fetchMock = fetchQueue(ok(envelope));
    vi.stubGlobal('fetch', fetchMock);

    const result = await invoke('test-campaign');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(url, opts);
    expect(result).toEqual(envelope);
  });
});

describe('custom-NPC invariant lanes (@app: npcs.json custom-only)', () => {
  // Server rejects bestiary names with a plain-English 400 (npcs.js:112 PUT, :44 POST);
  // the client lane surfaces the verbatim message and never retries.
  it.each([
    {
      label: 'saveNPC surfaces PUT bestiary guard 400 verbatim, one fetch only',
      invoke: (c) => saveNPC(c, { name: 'Goblin', race: 'Goblinoid' }),
      errorBody: { error: bestiaryError('Goblin') },
    },
    {
      label: 'saveNPCs surfaces POST validateList bestiary guard 400 verbatim, one fetch only',
      invoke: (c) => saveNPCs(c, [{ name: 'Owlbear' }]),
      errorBody: { error: bestiaryError('Owlbear') },
    },
  ])('$label', async ({ invoke, errorBody }) => {
    const fetchMock = fetchQueue(err(errorBody));
    vi.stubGlobal('fetch', fetchMock);

    await expect(invoke('test-campaign')).rejects.toThrow(errorBody.error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('error lane: server bytes verbatim, then || fallback, per export', () => {
  // Two pinned failed fetches per row: real server error field surfaces verbatim,
  // error-less JSON lands on the client's generic fallback string (#959).
  it.each([
    {
      label: 'saveNPC',
      invoke: (c) => saveNPC(c, CUSTOM_NPC),
      serverError: { error: 'Failed to update NPC' }, // npcs.js:129 -> asyncHandler 500
      fallback: 'Failed to save NPC',
    },
    {
      label: 'loadNPCs',
      invoke: (c) => loadNPCs(c),
      serverError: { error: 'Failed to read NPCs' }, // jsonEntityCrud.js:52
      fallback: 'Failed to load NPCs',
    },
    {
      label: 'saveNPCs',
      invoke: (c) => saveNPCs(c, []),
      serverError: { error: 'Expected an array for npcs' }, // jsonEntityCrud.js:62
      fallback: 'Failed to save NPCs',
    },
    {
      label: 'loadNPC',
      invoke: (c) => loadNPC(c, 'Bram Ironhand'),
      serverError: { error: 'NPC not found' }, // jsonEntityCrud.js:89/:97 404
      fallback: 'Failed to load NPC',
    },
    {
      label: 'deleteNPC',
      invoke: (c) => deleteNPC(c, 'Bram Ironhand'),
      serverError: { error: 'NPC not found' }, // jsonEntityCrud.js:119 404 (missing file)
      fallback: 'Failed to delete NPC',
    },
  ])('$label: error field verbatim, error-less JSON -> generic fallback', async ({ invoke, serverError, fallback }) => {
    const fetchMock = fetchQueue(err(serverError), err({}));
    vi.stubGlobal('fetch', fetchMock);

    await expect(invoke('test-campaign')).rejects.toThrow(serverError.error);
    await expect(invoke('test-campaign')).rejects.toThrow(fallback);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('every export propagates a network rejection unmodified', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('ENOTFOUND'))));

    await Promise.all([
      expect(saveNPC('test-campaign', CUSTOM_NPC)).rejects.toThrow('ENOTFOUND'),
      expect(loadNPCs('test-campaign')).rejects.toThrow('ENOTFOUND'),
      expect(saveNPCs('test-campaign', [])).rejects.toThrow('ENOTFOUND'),
      expect(loadNPC('test-campaign', 'Bram Ironhand')).rejects.toThrow('ENOTFOUND'),
      expect(deleteNPC('test-campaign', 'Bram Ironhand')).rejects.toThrow('ENOTFOUND'),
    ]);
  });
});

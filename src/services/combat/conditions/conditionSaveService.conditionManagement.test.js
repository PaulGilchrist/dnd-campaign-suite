// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../services/automation/handlers/buffs/auraOfPurityHandler.js', () => ({
  handle: vi.fn(),
  isAuraOfPurityActive: vi.fn(),
  getAuraOfPuritySaveAdvantageConditions: vi.fn(),
}));

vi.mock('../automation/automationService.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import {
  removeCondition,
  addCondition,
} from './conditionSaveService.js';

import { playerIsImmuneToCondition } from '../automation/automationService.js';

// ── Helpers ───────────────────────────────────────────────────────

function makeGetRuntimeValue(initial = {}) {
  const store = new Map();
  for (const [key, value] of Object.entries(initial)) {
    store.set(key, value);
  }
  return vi.fn((name, runtimeKey) => store.get(`${name}:${runtimeKey}`));
}

function makeSetRuntimeValue() {
  const calls = [];
  const fn = vi.fn((name, runtimeKey, value) => {
    calls.push({ name, runtimeKey, value });
  });
  fn.calls = calls;
  return fn;
}

// ── Tests ────────────────────────────────────────────────────────

describe('removeCondition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes condition by key or string, case-insensitive, from activeConditions', () => {
    const getRV = makeGetRuntimeValue({ 'Hero:activeConditions': ['blinded', 'Charmed'] });
    const setRV = makeSetRuntimeValue();

    removeCondition(
      { creatures: [{ type: 'player', name: 'Hero' }] },
      'Hero',
      { key: 'CHARMED' },
      getRV,
      setRV,
      'Campaign',
    );

    expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', ['blinded'], 'Campaign');

    vi.clearAllMocks();
    const getRV2 = makeGetRuntimeValue({ 'Hero:activeConditions': ['frightened', 'grappled'] });
    const setRV2 = makeSetRuntimeValue();

    removeCondition(
      { creatures: [{ type: 'player', name: 'Hero' }] },
      'Hero',
      'Frightened',
      getRV2,
      setRV2,
      'Campaign',
    );

    expect(setRV2).toHaveBeenCalledWith('Hero', 'activeConditions', ['grappled'], 'Campaign');
  });

  it('treats null/undefined activeConditions as empty array', () => {
    const setRV = makeSetRuntimeValue();

    removeCondition(
      { creatures: [{ type: 'player', name: 'Hero' }] },
      'Hero',
      { key: 'poisoned' },
      vi.fn(() => null),
      setRV,
      'Campaign',
    );
    expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', [], 'Campaign');

    vi.clearAllMocks();
    removeCondition(
      { creatures: [{ type: 'player', name: 'Hero' }] },
      'Hero',
      { key: 'poisoned' },
      vi.fn(() => undefined),
      setRV,
      'Campaign',
    );
    expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', [], 'Campaign');
  });

  it('leaves array unchanged when condition is not present', () => {
    const getRV = makeGetRuntimeValue({ 'Hero:activeConditions': ['blinded'] });
    const setRV = makeSetRuntimeValue();

    removeCondition(
      { creatures: [{ type: 'player', name: 'Hero' }] },
      'Hero',
      { key: 'charmed' },
      getRV,
      setRV,
      '',
    );

    expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', ['blinded'], '');
  });

  it('works for monster creatures', () => {
    const getRV = makeGetRuntimeValue({ 'Orc:activeConditions': ['blinded', 'charmed'] });
    const setRV = makeSetRuntimeValue();

    removeCondition(
      { creatures: [{ type: 'monster', name: 'Orc' }] },
      'Orc',
      { key: 'blinded' },
      getRV,
      setRV,
      '',
    );

    expect(setRV).toHaveBeenCalledWith('Orc', 'activeConditions', ['charmed'], '');
  });

  it('does not call setRuntimeValue when creature is not found', () => {
    const setRV = makeSetRuntimeValue();

    removeCondition(
      { creatures: [{ type: 'player', name: 'Other' }] },
      'NonExistent',
      { key: 'blinded' },
      vi.fn(),
      setRV,
      '',
    );

    expect(setRV).not.toHaveBeenCalled();
  });
});

describe('addCondition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips adding when playerStats is immune', () => {
    playerIsImmuneToCondition.mockReturnValue(true);
    const setRV = makeSetRuntimeValue();

    addCondition({
      combatSummary: { creatures: [{ type: 'player', name: 'Hero' }] },
      creatureName: 'Hero',
      conditionDef: { key: 'charmed', label: 'Charmed' },
      dc: 15,
      ability: 'wis',
      getRuntimeValue: vi.fn(),
      setRuntimeValue: setRV,
      campaignName: 'Campaign',
      playerStats: { name: 'Hero', allFeatures: [] },
    });

    expect(playerIsImmuneToCondition).toHaveBeenCalled();
    expect(setRV).not.toHaveBeenCalled();
  });

  it('skips immunity check when playerStats is null or campaignName is falsy', () => {
    const getRV = makeGetRuntimeValue({ 'Hero:activeConditions': [] });
    const setRV = makeSetRuntimeValue();

    addCondition({
      combatSummary: { creatures: [{ type: 'player', name: 'Hero' }] },
      creatureName: 'Hero',
      conditionDef: { key: 'charmed', label: 'Charmed' },
      dc: 15,
      ability: 'wis',
      getRuntimeValue: getRV,
      setRuntimeValue: setRV,
      campaignName: '',
      playerStats: null,
    });
    expect(playerIsImmuneToCondition).not.toHaveBeenCalled();

    vi.clearAllMocks();
    addCondition({
      combatSummary: { creatures: [{ type: 'player', name: 'Hero' }] },
      creatureName: 'Hero',
      conditionDef: { key: 'charmed', label: 'Charmed' },
      dc: 15,
      ability: 'wis',
      getRuntimeValue: getRV,
      setRuntimeValue: setRV,
      campaignName: '',
      playerStats: { name: 'Hero' },
    });
    expect(playerIsImmuneToCondition).not.toHaveBeenCalled();
  });

  it('calls playerIsImmuneToCondition with correct arguments when not immune', () => {
    playerIsImmuneToCondition.mockReturnValue(false);
    const getRV = makeGetRuntimeValue({ 'Hero:activeConditions': [] });
    const setRV = makeSetRuntimeValue();
    const playerStats = { name: 'Hero' };

    addCondition({
      combatSummary: { creatures: [{ type: 'player', name: 'Hero' }] },
      creatureName: 'Hero',
      conditionDef: { key: 'charmed', label: 'Charmed' },
      dc: 15,
      ability: 'wis',
      getRuntimeValue: getRV,
      setRuntimeValue: setRV,
      campaignName: 'Campaign',
      playerStats,
    });

    expect(playerIsImmuneToCondition).toHaveBeenCalledWith({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: getRV,
      campaignName: 'Campaign',
    });
  });

  it('appends new condition, deduplicates by key, and handles null activeConditions', () => {
    playerIsImmuneToCondition.mockReturnValue(false);

    const getRV1 = makeGetRuntimeValue({ 'Hero:activeConditions': ['blinded'] });
    const setRV1 = makeSetRuntimeValue();
    addCondition({
      combatSummary: { creatures: [{ type: 'player', name: 'Hero' }] },
      creatureName: 'Hero',
      conditionDef: { key: 'charmed', label: 'Charmed' },
      dc: 15,
      ability: 'wis',
      getRuntimeValue: getRV1,
      setRuntimeValue: setRV1,
      campaignName: 'Campaign',
      playerStats: {},
    });
    expect(setRV1).toHaveBeenCalledWith('Hero', 'activeConditions', ['blinded', 'charmed'], 'Campaign');

    vi.clearAllMocks();
    const getRV2 = makeGetRuntimeValue({ 'Hero:activeConditions': ['Charmed'] });
    const setRV2 = makeSetRuntimeValue();
    addCondition({
      combatSummary: { creatures: [{ type: 'player', name: 'Hero' }] },
      creatureName: 'Hero',
      conditionDef: { key: 'charmed', label: 'Charmed' },
      dc: 15,
      ability: 'wis',
      getRuntimeValue: getRV2,
      setRuntimeValue: setRV2,
      campaignName: 'Campaign',
      playerStats: {},
    });
    expect(setRV2).toHaveBeenCalledWith('Hero', 'activeConditions', ['charmed'], 'Campaign');

    vi.clearAllMocks();
    const getRV3 = vi.fn(() => null);
    const setRV3 = makeSetRuntimeValue();
    addCondition({
      combatSummary: { creatures: [{ type: 'player', name: 'Hero' }] },
      creatureName: 'Hero',
      conditionDef: { key: 'poisoned', label: 'Poisoned' },
      dc: 12,
      ability: 'con',
      getRuntimeValue: getRV3,
      setRuntimeValue: setRV3,
      campaignName: '',
      playerStats: {},
    });
    expect(setRV3).toHaveBeenCalledWith('Hero', 'activeConditions', ['poisoned'], '');
  });

  it('works for monster/npc creatures and does nothing when creature is not found', () => {
    playerIsImmuneToCondition.mockReturnValue(false);

    const getRV = makeGetRuntimeValue({ 'Goblin:activeConditions': ['blinded'] });
    const setRV = makeSetRuntimeValue();
    addCondition({
      combatSummary: { creatures: [{ type: 'npc', name: 'Goblin' }] },
      creatureName: 'Goblin',
      conditionDef: { key: 'frightened', label: 'Frightened' },
      dc: 13,
      ability: 'wis',
      getRuntimeValue: getRV,
      setRuntimeValue: setRV,
      campaignName: '',
      playerStats: null,
    });
    expect(setRV).toHaveBeenCalledWith('Goblin', 'activeConditions', ['blinded', 'frightened'], '');

    vi.clearAllMocks();
    const setRV2 = makeSetRuntimeValue();
    addCondition({
      combatSummary: { creatures: [{ type: 'player', name: 'Other' }] },
      creatureName: 'NonExistent',
      conditionDef: { key: 'blinded', label: 'Blinded' },
      dc: 10,
      ability: 'null',
      getRuntimeValue: vi.fn(),
      setRuntimeValue: setRV2,
      campaignName: '',
      playerStats: null,
    });
    expect(setRV2).not.toHaveBeenCalled();
  });
});

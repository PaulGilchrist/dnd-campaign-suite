import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockState = vi.hoisted(() => ({ logEntries: [], initialized: true }));
const mockAddEntry = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('../../hooks/runtime/useLog.js', () => ({
  default: vi.fn(() => ({
    logEntries: mockState.logEntries,
    initialized: mockState.initialized,
    addEntry: mockAddEntry,
  })),
}));

import Log from './Log.jsx';

const CHARS = [{ name: 'Frodo' }, { name: 'Aragorn' }];

const metaRegular = (o = {}) => ({
  id: 'mr', type: 'metamagic', characterName: 'Gandalf', spellName: 'Quickened Spell',
  options: ['Quickened Spell'], sorceryPointsSpent: 2,
  remainingSorceryPoints: 3, timestamp: Date.now(), ...o,
});

const pool = (o = {}) => ({
  id: 'p', type: 'healing_pool', sourceName: 'Paladin', targetName: 'Rogue',
  featureName: 'Lay on Hands', amount: 5, poolAfter: 20,
  rolls: [], diceUsed: 0, dieType: 6, timestamp: Date.now(), ...o,
});

const abilityUse = (o = {}) => ({
  id: 'au', type: 'ability_use', characterName: 'Paladin',
  abilityName: 'Healing Hands', description: '', timestamp: Date.now(), ...o,
});

function q(sel) {
  return document.querySelector(sel);
}

function setup(entries, initialized, characters) {
  mockState.logEntries.length = 0;
  if (entries) mockState.logEntries.push(...entries);
  mockState.initialized = initialized ?? true;
  return render(<Log campaignName="test-campaign" characters={characters ?? CHARS} />);
}

describe('MetamagicEntry - non-empowered path', () => {
  beforeEach(() => {
    mockState.logEntries.length = 0;
    mockState.initialized = true;
    mockAddEntry.mockClear();
  });

  it('renders spell name, options list, and SP cost', () => {
    setup([metaRegular({
      options: ['Quickened Spell', 'Careful Spell'],
      sorceryPointsSpent: 3,
      remainingSorceryPoints: 2,
    })]);
    expect(screen.getByText(/Metamagic Applied/i)).toBeInTheDocument();
    expect(screen.getByText(/Spell: Quickened Spell/i)).toBeInTheDocument();
    expect(document.querySelectorAll('.log-metamagic-option').length).toBe(2);
    expect(screen.getByText(/3 SP/i)).toBeInTheDocument();
    expect(screen.getByText(/Remaining: 2 SP/i)).toBeInTheDocument();
    expect(q('.log-entry.log-metamagic')).toBeInTheDocument();
    expect(q('.log-metamagic i.fa-dice')).toBeInTheDocument();
  });

  it('hides SP cost and remaining when zero/null', () => {
    setup([metaRegular({
      sorceryPointsSpent: 0,
      remainingSorceryPoints: null,
      options: ['Empowered Spell'],
    })]);
    expect(screen.getByText(/Empowered Spell/i)).toBeInTheDocument();
    expect(q('.log-metamagic-cost')).not.toBeInTheDocument();
    expect(q('.log-remaining-sp')).not.toBeInTheDocument();
  });

  it('hides options when not provided', () => {
    setup([metaRegular({
      options: null,
    })]);
    expect(q('.log-metamagic-option')).not.toBeInTheDocument();
  });

  it('renders metamagic_use type entry the same as metamagic', () => {
    setup([{ ...metaRegular(), type: 'metamagic_use' }]);
    expect(screen.getByText(/Metamagic Applied/i)).toBeInTheDocument();
    expect(q('.log-entry.log-metamagic')).toBeInTheDocument();
  });
});

describe('MetamagicEntry - empowered path edge cases', () => {
  beforeEach(() => {
    mockState.logEntries.length = 0;
    mockState.initialized = true;
    mockAddEntry.mockClear();
  });

  const meta = (o = {}) => ({
    id: 'm', type: 'metamagic', characterName: 'Gandalf', spellName: 'Fireball',
    targetName: 'Orc', originalDamage: 30, newTotal: 38, damageDifference: 8,
    rerolledDiceCount: 2, rollType: 'empowered-spell', timestamp: Date.now(), ...o,
  });

  it('shows singular "die" when rerolledDiceCount is 1', () => {
    setup([meta({ rerolledDiceCount: 1 })]);
    expect(q('.log-empowered-dice-info').textContent).toContain('Rerolled 1 die');
  });

  it('shows plural "dice" when rerolledDiceCount is greater than 1', () => {
    setup([meta({ rerolledDiceCount: 3 })]);
    expect(q('.log-empowered-dice-info').textContent).toContain('Rerolled 3 dice');
  });

  it('shows neutral class when damageDifference is zero', () => {
    setup([meta({ damageDifference: 0 })]);
    expect(q('.log-empowered-neutral')).toBeInTheDocument();
    expect(q('.log-empowered-positive')).not.toBeInTheDocument();
    expect(q('.log-empowered-negative')).not.toBeInTheDocument();
  });

  it('shows negative class with minus sign when damageDifference is negative', () => {
    setup([meta({ damageDifference: -3 })]);
    expect(q('.log-empowered-negative')).toBeInTheDocument();
    expect(screen.getByText(/-3/i)).toBeInTheDocument();
    expect(q('.log-empowered-positive')).not.toBeInTheDocument();
  });

  it('shows positive class with plus sign when damageDifference is positive', () => {
    setup([meta({ damageDifference: 5 })]);
    expect(q('.log-empowered-positive')).toBeInTheDocument();
    expect(q('.log-empowered-negative')).not.toBeInTheDocument();
  });
});

describe('HealingPoolEntry - dice pool and non-dice pool', () => {
  beforeEach(() => {
    mockState.logEntries.length = 0;
    mockState.initialized = true;
    mockAddEntry.mockClear();
  });

  it('renders dice pool with rolls, diceUsed, dieType', () => {
    setup([pool({
      rolls: [3, 5, 2],
      diceUsed: 3,
      dieType: 6,
      amount: 10,
      poolAfter: 15,
    })]);
    expect(screen.getByText(/Rolled 3d6/i)).toBeInTheDocument();
    expect(screen.getByText(/3 \+ 5 \+ 2/i)).toBeInTheDocument();
    expect(screen.getByText(/= 10 HP from pool/i)).toBeInTheDocument();
    expect(screen.getByText(/15 remaining/i)).toBeInTheDocument();
    expect(q('.log-entry.log-healing')).toBeInTheDocument();
    expect(q('.log-healing i.fa-hand-holding-heart')).toBeInTheDocument();
  });

  it('renders non-dice pool (flat usage) for empty or undefined rolls', () => {
    setup([pool({
      rolls: [],
      amount: 5,
      poolAfter: 20,
    })]);
    expect(screen.getByText(/Used 5 HP point from pool/i)).toBeInTheDocument();
    expect(screen.getByText(/20 remaining/i)).toBeInTheDocument();

    cleanup();
    setup([pool({
      rolls: undefined,
      amount: 3,
      poolAfter: 17,
    })]);
    expect(screen.getByText(/Used 3 HP point from pool/i)).toBeInTheDocument();
    expect(screen.getByText(/17 remaining/i)).toBeInTheDocument();
  });

  it('shows feature name and target in header', () => {
    setup([pool({
      featureName: 'Divine Favor',
      targetName: 'Barbarian',
      amount: 8,
      poolAfter: 12,
    })]);
    expect(screen.getByText(/Divine Favor → Barbarian \(\+8 HP\)/i)).toBeInTheDocument();
  });
});

describe('AbilityUseEntry - save details and death save', () => {
  beforeEach(() => {
    mockState.logEntries.length = 0;
    mockState.initialized = true;
    mockAddEntry.mockClear();
  });

  it('renders save details with roll, bonus, total, DC, and success/failure', () => {
    setup([abilityUse({
      abilityName: 'Second Wind',
      saveRoll: 14,
      saveBonus: 3,
      saveTotal: 17,
      saveDc: 15,
      saveSuccess: true,
      hpGained: 5,
    })]);
    expect(screen.getByText(/\(14\)/i)).toBeInTheDocument();
    expect(screen.getByText(/\+3 = 17 vs DC 15/i)).toBeInTheDocument();
    expect(screen.getByText(/SUCCESS/i)).toBeInTheDocument();
    expect(q('.log-save-result.log-condition-success')).toBeInTheDocument();
    expect(screen.getByText(/\+5 HP/i)).toBeInTheDocument();
    expect(q('.log-ability-save-details')).toBeInTheDocument();
  });

  it('renders save failure', () => {
    setup([abilityUse({
      abilityName: 'Test Ability',
      saveRoll: 8,
      saveBonus: 2,
      saveTotal: 10,
      saveDc: 15,
      saveSuccess: false,
    })]);
    expect(screen.getByText(/FAILURE/i)).toBeInTheDocument();
    expect(q('.log-save-result.log-condition-failure')).toBeInTheDocument();
  });

  it('renders death save success', () => {
    setup([abilityUse({
      abilityName: 'Stabilize',
      deathSaveRoll: 16,
      deathSaveSuccess: true,
    })]);
    expect(screen.getByText(/Death Save:/i)).toBeInTheDocument();
    expect(screen.getByText(/\(16\)/i)).toBeInTheDocument();
    expect(screen.getByText(/SUCCESS/i)).toBeInTheDocument();
    expect(q('.log-ability-death-save')).toBeInTheDocument();
    expect(q('.log-ability-death-save i.fa-skull-crossbones')).toBeInTheDocument();
  });

  it('renders death save failure', () => {
    setup([abilityUse({
      abilityName: 'Stabilize',
      deathSaveRoll: 8,
      deathSaveSuccess: false,
    })]);
    expect(screen.getByText(/Death Save:/i)).toBeInTheDocument();
    expect(screen.getByText(/\(8\)/i)).toBeInTheDocument();
    expect(screen.getByText(/FAILURE/i)).toBeInTheDocument();
    expect(q('.log-save-result.log-condition-failure')).toBeInTheDocument();
  });

  it('renders source tag when different from abilityName, hides when same', () => {
    setup([abilityUse({
      abilityName: 'Second Wind',
      source: 'Fighter Level 2',
    })]);
    expect(q('.log-source-tag')).toBeInTheDocument();
    expect(q('.log-source-tag')).toHaveTextContent(/Fighter Level 2/i);

    cleanup();
    setup([abilityUse({
      abilityName: 'Second Wind',
      source: 'Second Wind',
    })]);
    expect(q('.log-source-tag')).not.toBeInTheDocument();
  });

  it('renders minimal entry without save details or death save', () => {
    setup([abilityUse({})]);
    expect(q('.log-entry.log-ability-use')).toBeInTheDocument();
    expect(q('.log-ability-save-details')).not.toBeInTheDocument();
    expect(q('.log-ability-death-save')).not.toBeInTheDocument();
  });
});

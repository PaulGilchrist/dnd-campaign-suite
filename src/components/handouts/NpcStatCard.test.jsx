// @maintained-by-ai 2026-11-25
// Item 4 NPC handout card contract: a combat-ready NPC prints the full stat
// block (AC/HP+HD/speed/initiative, abilities+mods, saves/skills/defenses,
// actions/traits/reactions) PLUS the roleplay essentials; a lore-only NPC
// (armorClass null — the editor's own gate) prints a clean roleplay card and
// NO fabricated block; and the GM-eyes-only `secrets`/`notes` fields NEVER
// reach paper even when the row carries them.
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import NpcStatCard from './NpcStatCard.jsx';

const combatNpc = {
  name: 'Cap Drill Sergeant',
  race: 'Human',
  classRole: 'Drill Sergeant',
  appearance: 'Bald, whistle always at the ready',
  personality: 'Barking-strict',
  goals: 'Drill the militia before winter',
  secrets: 'Deserted the Third Company',
  notes: 'GM-only sandbox marker',
  tags: 'sandbox-experiment',
  attitude: 'negative',
  armorClass: 14,
  hitPoints: 18,
  hitDice: '4d8',
  initiativeBonus: '+1',
  speed: { walk: '30 ft.' },
  abilityScores: { str: 12, dex: 14, con: 12, int: 10, wis: 11, cha: 10 },
  savingThrowBonuses: { str: 3 },
  skillBonuses: { Perception: 2 },
  damageResistances: ['Poison'],
  damageImmunities: [],
  conditionImmunities: ['Frightened'],
  actions: [{
    name: 'Needler Bolt',
    description: 'Ranged Weapon Attack: +5 to hit, range 60/120 ft., one target.',
  }],
  traits: 'Formation Voice: allies within 10 ft. gain advantage on fear saves.',
  reactions: 'Parry: +2 AC against one melee hit.',
};

const loreNpc = {
  name: 'Marta Copperkettle',
  race: '',
  classRole: 'Tavern Keeper',
  appearance: 'Apron, flour in her braids',
  personality: 'Warm, endlessly curious',
  goals: 'Find out who really pays the river tolls',
  secrets: 'Hides a sealed letter under the floor',
  notes: 'GM reminder: never reveal the letter in session 1',
  tags: '',
  attitude: 'positive',
  armorClass: null,
  hitPoints: null,
  hitDice: '',
  abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  actions: [],
};

describe('NpcStatCard', () => {
  afterEach(cleanup);

  it('combat-ready NPC prints the full stat block', () => {
    const { container } = render(<NpcStatCard npc={combatNpc} />);
    expect(screen.getByText('Cap Drill Sergeant')).toBeInTheDocument();
    expect(screen.getByText('Human / Drill Sergeant')).toBeInTheDocument();
    expect(container.querySelector('.handout-statblock')).not.toBeNull();

    const rules = container.querySelectorAll('.handout-rule').length
      + container.querySelectorAll('.handout-rule-lead').length;
    expect(rules).toBeGreaterThan(0);
    const text = container.textContent;
    expect(text).toContain('Armor Class');
    expect(text).toContain('18 (4d8)');
    expect(text).toContain('Speed');
    expect(text).toContain('30 ft.');
    expect(text).toContain('Initiative');
    expect(text).toContain('+1');
    ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].forEach(label =>
      expect(screen.getByText(label)).toBeInTheDocument());
    expect(screen.getAllByText('14').length).toBeGreaterThanOrEqual(1); // DEX score cell (+ AC line)
    expect(text).toContain('Saving Throws');
    expect(text).toContain('STR +3');
    expect(text).toContain('Skills');
    expect(text).toContain('Perception +2');
    expect(text).toContain('Poison');
    expect(text).toContain('Frightened');
    expect(text).toContain('Needler Bolt');
    expect(text).toContain('Formation Voice');
    expect(text).toContain('Parry');
  });

  it('combat-ready NPC also prints roleplay essentials, attitude and tags', () => {
    const { container } = render(<NpcStatCard npc={combatNpc} />);
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(container.textContent).toContain('Bald, whistle always at the ready');
    expect(screen.getByText('Personality')).toBeInTheDocument();
    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(container.textContent).toContain('Attitude: negative');
    expect(container.textContent).toContain('Tags: sandbox-experiment');
  });

  it('GM-eyes-only secrets and notes NEVER reach paper', () => {
    const { container } = render(<NpcStatCard npc={combatNpc} />);
    expect(container.textContent).not.toContain('Deserted the Third Company');
    expect(container.textContent).not.toContain('GM-only sandbox marker');
    cleanup();
    const lore = render(<NpcStatCard npc={loreNpc} />);
    expect(lore.container.textContent).not.toContain('sealed letter');
    expect(lore.container.textContent).not.toContain('never reveal the letter');
  });

  it('lore-only NPC prints a clean roleplay card with no fabricated stats', () => {
    const { container } = render(<NpcStatCard npc={loreNpc} />);
    expect(screen.getByText('Marta Copperkettle')).toBeInTheDocument();
    expect(screen.getByText('Tavern Keeper')).toBeInTheDocument();
    expect(container.querySelector('.handout-statblock')).toBeNull();
    expect(container.textContent).not.toContain('Armor Class');
    expect(container.textContent).not.toContain('Saving Throws');
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(container.textContent).toContain('Apron, flour in her braids');
    expect(container.textContent).toContain('Attitude: positive');
  });

  it('lore-only NPC with nothing authored says so honestly', () => {
    const { container } = render(<NpcStatCard npc={{ ...loreNpc, appearance: '', personality: '', goals: '' }} />);
    expect(container.textContent).toContain('A lore-only NPC with no roleplay notes authored yet');
  });

  it('missing NPC data renders an honest empty face, never a crash', () => {
    const { container } = render(<NpcStatCard npc={null} />);
    expect(container.textContent).toContain('No NPC data to print');
  });

  it('dice-formatted HP string is not doubled with the hit dice', () => {
    const { container } = render(<NpcStatCard npc={{ ...combatNpc, hitPoints: '9 (2d8)' }} />);
    expect(container.textContent).toContain('9 (2d8)');
    expect(container.textContent).not.toContain('9 (2d8) (4d8)');
  });
});

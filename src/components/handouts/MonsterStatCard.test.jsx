// @maintained-by-ai 2026-11-25
// Item 4 monster print card contract: the printed face is the monsters.json
// row verbatim — standard 5e stat-block lines, ability grid, CR/XP, and the
// traits/actions/reactions/legendary sections — with live-combat overlays
// absent BY CONSTRUCTION (the card reads no runtime store).
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import MonsterStatCard from './MonsterStatCard.jsx';

// Trimmed shape of the real /data/monsters.json Goblin row.
const goblin = {
  index: 'goblin',
  name: 'Goblin',
  size: 'Small',
  type: 'humanoid',
  subtype: 'goblinoid',
  alignment: 'neutral evil',
  armor_class: 15,
  armor_class_details: '15 (studded leather, shield)',
  hit_points: 7,
  hit_dice: '2d6',
  initiative_details: '+2',
  speed: { walk: '30 ft.' },
  ability_scores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  ability_score_modifiers: { str: -1, dex: 2, con: 0, int: 0, wis: -1, cha: -1 },
  saving_throws: {},
  skills: { Stealth: { bonus: 6 } },
  senses: { darkvision: '60 ft.', passive_perception: 9 },
  damage_vulnerabilities: [],
  damage_resistances: [],
  damage_immunities: [],
  condition_immunities: [],
  languages: 'Common, Goblin',
  challenge_rating: '0.25',
  xp: 50,
  traits: [
    { name: 'Nimble Escape', description: 'The goblin can take the Disengage or Hide action as a bonus action.' },
  ],
  actions: [
    { name: 'Scimitar', description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target.' },
    { name: 'Shortbow', description: 'Ranged Weapon Attack: +4 to hit, range 80/320 ft.' },
  ],
  reactions: [],
  legendary_actions: [],
};

describe('MonsterStatCard', () => {
  afterEach(cleanup);

  it('prints the identity block: name, size/type/subtype, alignment', () => {
    render(<MonsterStatCard monster={goblin} />);
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Small humanoid (goblinoid), neutral evil')).toBeInTheDocument();
  });

  it('prints the standard rule lines with authored details', () => {
    const { container } = render(<MonsterStatCard monster={goblin} />);
    // Rule leads join their values with a non-breaking space.
    const text = container.textContent.replace(/\u00a0/g, ' ');
    expect(text).toContain('Armor Class');
    expect(text).toContain('15 (studded leather, shield)');
    expect(text).toContain('7 (2d6)');
    expect(text).toContain('Speed');
    expect(text).toContain('30 ft.');
    expect(text).toContain('Initiative');
    expect(text).toContain('darkvision 60 ft., passive Perception 9');
    expect(text).toContain('Common, Goblin');
    expect(text).toContain('Challenge 1/4 (50 XP)');
  });

  it('prints the six-cell ability grid with signed modifiers', () => {
    const { container } = render(<MonsterStatCard monster={goblin} />);
    const cells = container.querySelectorAll('.handout-ability');
    expect(cells).toHaveLength(6);
    expect(container.textContent).toContain('-1');
    expect(container.textContent).toContain('+2');
    expect(container.textContent).toContain('+0');
  });

  it('prints skills from the skills map', () => {
    const { container } = render(<MonsterStatCard monster={goblin} />);
    expect(container.textContent).toContain('Stealth +6');
  });

  it('prints trait, action and reaction sections; empty sections hide', () => {
    const first = render(<MonsterStatCard monster={goblin} />);
    expect(first.container.textContent).toContain('Nimble Escape');
    expect(first.container.textContent).toContain('Scimitar');
    expect(first.container.textContent).toContain('Shortbow');
    expect(first.container.textContent).not.toContain('Reactions');
    expect(first.container.textContent).not.toContain('Legendary Actions');
    cleanup();
    const second = render(<MonsterStatCard monster={{ ...goblin, legendary_actions: [{ name: 'Fury', description: 'One rush.' }] }} />);
    expect(second.container.textContent).toContain('Legendary Actions');
    expect(second.container.textContent).toContain('Fury');
  });

  it('legendary resistance earns its /Day line only when authored', () => {
    const first = render(<MonsterStatCard monster={goblin} />);
    expect(first.container.textContent).not.toContain('Legendary Resistance');
    cleanup();
    const second = render(<MonsterStatCard monster={{ ...goblin, legendary_resistance: 3 }} />);
    expect(second.container.textContent.replace(/\u00a0/g, ' ')).toContain('Legendary Resistance 3/Day');
  });

  it('unknown monster prints an honest empty face', () => {
    const { container } = render(<MonsterStatCard monster={null} />);
    expect(container.textContent).toContain('No monster data to print');
  });
});

// @maintained-by-ai 2026-11-25
// Item 4 encounter sheet handout contract: the SAVED pool row (name,
// selectedMonsters refs, description, effectiveXP) renders a full roster
// table whose CR/XP columns are derived from the bestiary rows the host
// passes, the party section prints the shared XP-threshold math with the
// same ratio bands as the on-screen builder, and the markdown description
// flows through the ONE sink. The handout reads props only — zero fetches.
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import EncounterSheetHandout from './EncounterSheetHandout.jsx';

const goblin = { index: 'goblin', name: 'Goblin', armor_class: 15, hit_points: 7, speed: { walk: '30 ft.' }, challenge_rating: '0.25', xp: 50 };
const hobgoblin = { index: 'hobgoblin', name: 'Hobgoblin', armor_class: 18, hit_points: 11, speed: { walk: '30 ft.' }, challenge_rating: 1, xp: 200 };

const savedEncounter = {
  name: 'Goblin Ambush',
  savedAt: '2026-08-21T13:30:56.500Z',
  selectedMonsters: [
    { index: 'goblin', name: 'Goblin', qty: 2 },
    { index: 'hobgoblin', name: 'Hobgoblin', qty: 1 },
  ],
  description: 'Ambush at the **crossing**.',
  effectiveXP: 400,
};

describe('EncounterSheetHandout', () => {
  afterEach(cleanup);

  it('prints the identity line, save date and creature count', () => {
    const { container } = render(
      <EncounterSheetHandout encounter={savedEncounter} monsters={[goblin, hobgoblin]} partyLevels={[1, 1]} />
    );
    expect(screen.getByText('Encounter: Goblin Ambush')).toBeInTheDocument();
    expect(container.textContent).toContain('21 Aug 2026');
    expect(container.textContent).toContain('3 creatures');
  });

  it('roster rows carry the derived bestiary columns and per-row XP = xp × qty', () => {
    const { container } = render(
      <EncounterSheetHandout encounter={savedEncounter} monsters={[goblin, hobgoblin]} partyLevels={[1]} />
    );
    const rows = [...container.querySelectorAll('.handout-roster-row')];
    expect(rows).toHaveLength(2);
    const [first, second] = rows.map(r => r.textContent);
    expect(first).toContain('Goblin');
    expect(first).toContain('1/4');
    expect(first).toContain('100'); // 50 XP × qty 2
    expect(second).toContain('Hobgoblin');
    expect(second).toContain('18');
    expect(second).toContain('200');
    expect(container.querySelector('tfoot').textContent).toContain('300'); // base total pre-multiplier
  });

  it('party section prints thresholds and the shared difficulty verdict', () => {
    const { container } = render(
      <EncounterSheetHandout encounter={savedEncounter} monsters={[goblin, hobgoblin]} partyLevels={[1]} />
    );
    // ENCOUNTER_CONFIG rows are level-indexed from 0, so level 1 reads
    // [25, 50, 75, 100].
    expect(container.textContent).toContain('25 XP');
    expect(container.textContent).toContain('50 XP');
    expect(container.textContent).toContain('75 XP');
    expect(container.textContent).toContain('100 XP');
    // 400 effective XP vs a 50-medium threshold → Deadly (shared bands).
    expect(container.textContent).toContain('Deadly');
  });

  it('renders the markdown description through the shared sink', () => {
    const { container } = render(
      <EncounterSheetHandout encounter={savedEncounter} monsters={[goblin, hobgoblin]} partyLevels={[1]} />
    );
    expect(container.querySelector('.handout-encounter-description strong')).not.toBeNull();
    expect(container.textContent).toContain('Ambush at the crossing.');
  });

  it('an empty roster prints an honest empty face instead of a bare table', () => {
    const { container } = render(
      <EncounterSheetHandout encounter={{ name: 'Empty', selectedMonsters: [] }} monsters={[]} partyLevels={[1]} />
    );
    expect(container.textContent).toContain('This encounter has no monsters selected.');
  });

  it('no party levels: honest no-verdict line, no fabricated difficulty', () => {
    const { container } = render(
      <EncounterSheetHandout encounter={savedEncounter} monsters={[goblin]} partyLevels={[]} />
    );
    expect(container.textContent).toContain('No party levels selected');
    expect(container.textContent).not.toContain('Difficulty');
  });

  it('an unknown bestiary index still prints the saved name with dash columns', () => {
    const { container } = render(
      <EncounterSheetHandout
        encounter={{ name: 'Mystery', selectedMonsters: [{ index: 'gone', name: 'Lost Beast', qty: 1 }], effectiveXP: 0 }}
        monsters={[goblin]}
        partyLevels={[1]}
      />
    );
    const row = container.querySelector('.handout-roster-row');
    expect(row.textContent).toContain('Lost Beast');
    expect(row.textContent).toContain('—');
  });

  it('missing encounter renders an honest empty face', () => {
    const { container } = render(<EncounterSheetHandout encounter={null} />);
    expect(container.textContent).toContain('No encounter selected to print');
  });
});

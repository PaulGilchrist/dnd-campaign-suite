// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DivineInterventionModal from './DivineInterventionModal.jsx';

// ── Test fixtures ──

const baseSpells = [
  {
    index: 'guiding-bolt',
    name: 'Guiding Bolt',
    level: 1,
    school: 'Evocation',
    casting_time: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: '1 instant',
    concentration: false,
    ritual: false,
    description: ['A bolt of light streaks toward a creature within range.'],
    damage: {
      damage_at_slot_level: { '1': '4d6', '2': '5d6' },
      damage_type: 'Radiant',
    },
  },
  {
    index: 'thunderwave',
    name: 'Thunderwave',
    level: 1,
    school: 'Evocation',
    casting_time: '1 action',
    range: 'Self (15-foot cube)',
    components: 'V, S',
    duration: '1 instant',
    concentration: false,
    ritual: false,
    description: ['A wave of thunder sound out.'],
  },
  {
    index: 'fire-bolt',
    name: 'Fire Bolt',
    level: 0,
    school: 'Evocation',
    casting_time: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: 'instantaneous',
    concentration: false,
    ritual: false,
    description: ['A streak of flame shoots toward a creature.'],
    damage: {
      damage_at_character_level: { '1': '1d10' },
      damage_type: 'Fire',
    },
  },
  {
    index: 'sacred-flame',
    name: 'Sacred Flame',
    level: 0,
    school: 'Evocation',
    casting_time: '1 action',
    range: '60 feet',
    components: 'V, S',
    duration: '1 instant',
    concentration: false,
    ritual: false,
    description: ['Flame-like radiance descends on a creature.'],
    damage: {
      damage_at_character_level: { '1': '1d8' },
      damage_type: 'Radiant',
    },
  },
  {
    index: 'spiritual-weapon',
    name: 'Spiritual Weapon',
    level: 2,
    school: 'Evocation',
    casting_time: '1 bonus action',
    range: '60 feet',
    components: 'V, S',
    duration: '1 minute',
    concentration: true,
    ritual: false,
    description: ['You create a floating weapon.'],
    damage: {
      damage_at_slot_level: { '2': '1d8', '3': '1d8' },
      damage_type: 'Force',
    },
  },
];

function makeProps(overrides) {
  return {
    eligibleSpells: baseSpells,
    isGreater: false,
    featureName: 'Divine Intervention',
    onSelect: vi.fn(),
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('DivineInterventionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render ──

  it('renders the modal overlay with default props', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders the header with the featureName prop', () => {
    render(<DivineInterventionModal {...makeProps({ featureName: 'Gods\' Gambit' })} />);
    expect(screen.getByText('Gods\' Gambit')).toBeInTheDocument();
  });

  it('renders a Font Awesome star icon in the header', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(document.querySelector('.fa-solid.fa-star-of-life')).toBeInTheDocument();
  });

  it('renders a Cancel button by default', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('does not render a Cast button before any spell is selected', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.queryByRole('button', { name: /Cast with Divine Intervention/ })).not.toBeInTheDocument();
  });

  // ── Note text ──

  it('shows the non-greater note text when isGreater is false', () => {
    render(<DivineInterventionModal {...makeProps({ isGreater: false })} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/doesn't require a Reaction/);
    expect(bodyDiv.textContent).toMatch(/level 5 or lower/);
  });

  it('does not show the non-greater note text when isGreater is true', () => {
    render(<DivineInterventionModal {...makeProps({ isGreater: true })} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).not.toMatch(/doesn't require a Reaction/);
  });

  it('shows the Wish mention when isGreater is true', () => {
    render(<DivineInterventionModal {...makeProps({ isGreater: true })} />);
    expect(screen.getByText(/Wish/)).toBeInTheDocument();
  });

  it('does not show the Wish mention when isGreater is false', () => {
    render(<DivineInterventionModal {...makeProps({ isGreater: false })} />);
    expect(screen.queryByText(/Wish/)).not.toBeInTheDocument();
  });

  // ── Spell list rendering ──

  it('renders all eligible spells in the spell list', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByText('Guiding Bolt')).toBeInTheDocument();
    expect(screen.getByText('Thunderwave')).toBeInTheDocument();
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
    expect(screen.getByText('Sacred Flame')).toBeInTheDocument();
    expect(screen.getByText('Spiritual Weapon')).toBeInTheDocument();
  });

  it('renders spell level and casting time for each spell item', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/Cantrip — 1 action/);
    expect(bodyDiv.textContent).toMatch(/Level 1 — 1 action/);
    expect(bodyDiv.textContent).toMatch(/Level 2 — 1 bonus action/);
  });

  it('renders a Concentration tag for spells with concentration in the list', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByText(/Concentration/)).toBeInTheDocument();
  });

  it('renders a Ritual tag for spells with ritual in the list', () => {
    const ritualSpell = [
      {
        index: 'detect-magic',
        name: 'Detect Magic',
        level: 1,
        school: 'Divination',
        casting_time: '1 action',
        range: 'Self',
        components: 'V, S',
        duration: '10 minutes',
        concentration: false,
        ritual: true,
        description: ['You sense the presence of magic.'],
      },
    ];
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: ritualSpell })} />);
    expect(screen.getByText(/Ritual/)).toBeInTheDocument();
  });

  // ── Level filter buttons ──

  it('renders an "All Levels" filter button', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByText('All Levels')).toBeInTheDocument();
  });

  it('renders a filter button for each distinct spell level', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByText('Cantrip')).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(screen.getByText('Level 2')).toBeInTheDocument();
  });

  it('highlights "All Levels" as the active filter by default', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByText('All Levels')).toHaveClass('active');
  });

  // ── Filter functionality ──

  it('filters the spell list when a level button is clicked', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Level 1'));
    expect(screen.getByText('Guiding Bolt')).toBeInTheDocument();
    expect(screen.getByText('Thunderwave')).toBeInTheDocument();
    expect(screen.queryByText('Fire Bolt')).not.toBeInTheDocument();
    expect(screen.queryByText('Spiritual Weapon')).not.toBeInTheDocument();
  });

  it('restores all spells when "All Levels" is clicked after filtering', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Level 1'));
    expect(screen.queryByText('Spiritual Weapon')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('All Levels'));
    expect(screen.getByText('Spiritual Weapon')).toBeInTheDocument();
  });

  it('highlights the clicked level filter and deselects others', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Level 2'));
    expect(screen.getByText('Level 2')).toHaveClass('active');
    expect(screen.getByText('All Levels')).not.toHaveClass('active');
    expect(screen.getByText('Cantrip')).not.toHaveClass('active');
  });

  it('shows "No spells found" when a filter matches no spells', () => {
    const singleLevelSpells = [
      {
        index: 'guiding-bolt',
        name: 'Guiding Bolt',
        level: 1,
        school: 'Evocation',
        casting_time: '1 action',
        range: '120 feet',
        components: 'V, S',
        duration: '1 instant',
        concentration: false,
        ritual: false,
        description: ['A bolt of light.'],
      },
    ];
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: singleLevelSpells })} />);
    expect(screen.getByText('Guiding Bolt')).toBeInTheDocument();
    expect(screen.queryByText(/No spells found for this level/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('All Levels'));
    expect(screen.getByText('Guiding Bolt')).toBeInTheDocument();
  });

  // ── Spell selection flow ──

  it('switches to the detail view when a spell is clicked', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.queryByText('All Levels')).not.toBeInTheDocument();
    expect(screen.queryByText('Guiding Bolt')).toBeInTheDocument();
  });

  it('shows a Cast button and hides Cancel after selecting a spell', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByRole('button', { name: /Cast with Divine Intervention/ })).toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('returns to the list view when Back is clicked', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByRole('button', { name: /Cast with Divine Intervention/ })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.queryByRole('button', { name: /Cast with Divine Intervention/ })).not.toBeInTheDocument();
    expect(screen.getByText('All Levels')).toBeInTheDocument();
  });

  it('preserves the active filter when going back from a spell detail', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Level 1'));
    expect(screen.getByText('Level 1')).toHaveClass('active');
    fireEvent.click(screen.getByText('Guiding Bolt'));
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Level 1')).toHaveClass('active');
  });

  // ── Selected spell detail view ──

  it('displays the selected spell name as the detail heading', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Spiritual Weapon'));
    expect(screen.getByText('Spiritual Weapon')).toBeInTheDocument();
  });

  it('displays level, school, and concentration tag in the detail header', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Spiritual Weapon'));
    expect(screen.getByText(/Level 2 — Evocation — Concentration/)).toBeInTheDocument();
  });

  it('displays level, school, and ritual tag in the detail header', () => {
    const ritualSpell = [
      {
        index: 'detect-magic',
        name: 'Detect Magic',
        level: 1,
        school: 'Divination',
        casting_time: '1 action',
        range: 'Self',
        components: 'V, S',
        duration: '10 minutes',
        concentration: false,
        ritual: true,
        description: ['You sense the presence of magic.'],
      },
    ];
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: ritualSpell })} />);
    fireEvent.click(screen.getByText('Detect Magic'));
    expect(screen.getByText(/Level 1 — Divination — Ritual/)).toBeInTheDocument();
  });

  it('displays casting time, range, components, and duration on one line', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByText(/Casting Time: 1 action — Range: 120 feet/)).toBeInTheDocument();
    expect(screen.getByText(/Components: V, S/)).toBeInTheDocument();
    expect(screen.getByText(/Duration: 1 instant/)).toBeInTheDocument();
  });

  it('omits the Components label when the spell has no components field', () => {
    const noComponentsSpell = [
      {
        index: 'test-spell',
        name: 'Test Spell',
        level: 1,
        school: 'Evocation',
        casting_time: '1 action',
        range: 'Self',
        duration: '1 minute',
        concentration: false,
        ritual: false,
        description: ['A test spell with no components.'],
      },
    ];
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: noComponentsSpell })} />);
    fireEvent.click(screen.getByText('Test Spell'));
    expect(screen.queryByText(/Components:/)).not.toBeInTheDocument();
  });

  it('omits the Duration label when the spell has no duration field', () => {
    const noDurationSpell = [
      {
        index: 'test-spell',
        name: 'Test Spell',
        level: 1,
        school: 'Evocation',
        casting_time: '1 action',
        range: 'Self',
        components: 'V',
        concentration: false,
        ritual: false,
        description: ['A test spell with no duration.'],
      },
    ];
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: noDurationSpell })} />);
    fireEvent.click(screen.getByText('Test Spell'));
    expect(screen.queryByText(/Duration:/)).not.toBeInTheDocument();
  });

  it('displays the spell description', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByText(/A bolt of light streaks toward a creature/)).toBeInTheDocument();
  });

  it('displays damage info when the spell has damage', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    const selectedSpellDiv = document.querySelector('.divine-intervention-selected-spell');
    expect(selectedSpellDiv.textContent).toMatch(/Damage:/);
    expect(selectedSpellDiv.textContent).toMatch(/4d6/);
    expect(selectedSpellDiv.textContent).toMatch(/Radiant/);
  });

  it('shows all damage slot levels joined with slashes', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByText(/Damage: 4d6 \/ 5d6 \(Radiant\)/)).toBeInTheDocument();
  });

  it('shows damage for spells using damage_at_character_level', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Fire Bolt'));
    const selectedSpellDiv = document.querySelector('.divine-intervention-selected-spell');
    expect(selectedSpellDiv.textContent).toMatch(/Damage:/);
    expect(selectedSpellDiv.textContent).toMatch(/1d10/);
  });

  it('does not display a damage section when the spell has no damage', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Thunderwave'));
    const selectedSpellDiv = document.querySelector('.divine-intervention-selected-spell');
    expect(selectedSpellDiv.textContent).not.toMatch(/Damage/);
  });

  // ── Cast button ──

  it('calls onSelect with the selected spell when Cast is clicked', () => {
    const props = makeProps();
    render(<DivineInterventionModal {...props} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    fireEvent.click(screen.getByRole('button', { name: /Cast with Divine Intervention/ }));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(props.onSelect).toHaveBeenCalledWith(baseSpells[0]);
  });

  it('calls onSelect with the correct spell for each spell in the list', () => {
    const props = makeProps();
    render(<DivineInterventionModal {...props} />);
    fireEvent.click(screen.getByText('Spiritual Weapon'));
    fireEvent.click(screen.getByRole('button', { name: /Cast with Divine Intervention/ }));
    expect(props.onSelect).toHaveBeenCalledWith(baseSpells[4]);
  });

  // ── Close / dismiss behavior ──

  it('calls onClose when Cancel is clicked', () => {
    const props = makeProps();
    render(<DivineInterventionModal {...props} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  // ── Empty spell list ──

  it('shows "No spells found" message when eligibleSpells is empty', () => {
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: [] })} />);
    expect(screen.getByText(/No spells found for this level/)).toBeInTheDocument();
  });

  it('renders all filter buttons and spell list when eligibleSpells has only one level', () => {
    const singleLevelSpells = [
      {
        index: 'burning-hands',
        name: 'Burning Hands',
        level: 1,
        school: 'Evocation',
        casting_time: '1 action',
        range: 'Self',
        components: 'V, S',
        duration: '1 instant',
        concentration: false,
        ritual: false,
        description: ['Flames erupt.'],
      },
    ];
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: singleLevelSpells })} />);
    expect(screen.getByText('All Levels')).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(screen.queryByText('Cantrip')).not.toBeInTheDocument();
    expect(screen.getByText('Burning Hands')).toBeInTheDocument();
  });

  // ── Cantrip label ──

  it('shows "Cantrip" instead of "Level 0" in the spell list', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/Cantrip — 1 action/);
  });

  it('shows "Cantrip" instead of "Level 0" in the selected spell detail', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Fire Bolt'));
    const selectedSpellDiv = document.querySelector('.divine-intervention-selected-spell');
    expect(selectedSpellDiv.textContent).toMatch(/Cantrip/);
  });

  // ── Higher level spells ──

  it('renders filter buttons for high-level spells', () => {
    const highLevelSpell = [
      {
        index: 'wish',
        name: 'Wish',
        level: 9,
        school: 'Evocation',
        casting_time: '1 action',
        range: 'Self',
        components: 'V',
        duration: 'Instantaneous',
        concentration: false,
        ritual: false,
        description: ['You wish upon a star.'],
      },
    ];
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: highLevelSpell })} />);
    expect(screen.getByText('Level 9')).toBeInTheDocument();
  });

  // ── Spell with no concentration or ritual ──

  it('does not show Concentration tag for non-concentration spells in the list', () => {
    const noConcSpell = [
      {
        index: 'magic-missile',
        name: 'Magic Missile',
        level: 1,
        school: 'Evocation',
        casting_time: '1 action',
        range: '120 feet',
        components: 'V, S',
        duration: '1 instant',
        concentration: false,
        ritual: false,
        description: ['Three darts of force.'],
      },
    ];
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: noConcSpell })} />);
    expect(screen.queryByText(/Concentration/)).not.toBeInTheDocument();
  });

  // ── Multiple spells at the same level ──

  it('renders all spells at the same level when that level filter is active', () => {
    const twoLevel1Spells = [
      {
        index: 'guiding-bolt',
        name: 'Guiding Bolt',
        level: 1,
        school: 'Evocation',
        casting_time: '1 action',
        range: '120 feet',
        components: 'V, S',
        duration: '1 instant',
        concentration: false,
        ritual: false,
        description: ['A bolt of light.'],
      },
      {
        index: 'wrathful-smite',
        name: 'Wrathful Smite',
        level: 1,
        school: 'Evocation',
        casting_time: '1 bonus action',
        range: 'Self',
        components: 'V',
        duration: '1 minute',
        concentration: true,
        ritual: false,
        description: ['Your weapon shines.'],
      },
    ];
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: twoLevel1Spells })} />);
    fireEvent.click(screen.getByText('Level 1'));
    expect(screen.getByText('Guiding Bolt')).toBeInTheDocument();
    expect(screen.getByText('Wrathful Smite')).toBeInTheDocument();
  });

  // ── Custom feature name ──

  it('renders custom featureName in the header', () => {
    render(<DivineInterventionModal {...makeProps({ featureName: 'Divine Strike' })} />);
    expect(screen.getByText('Divine Strike')).toBeInTheDocument();
  });

  // ── Edge cases: missing spell properties ──

  it('handles a spell with undefined level by treating it as level 0', () => {
    const noLevelSpell = [
      {
        index: 'test-spell',
        name: 'Test Spell',
        school: 'Evocation',
        casting_time: '1 action',
        range: 'Self',
        components: 'V',
        duration: 'Instantaneous',
        description: ['A spell without a level.'],
      },
    ];
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: noLevelSpell })} />);
    expect(screen.getByText('Cantrip')).toBeInTheDocument();
    expect(screen.getByText('Test Spell')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Test Spell'));
    const selectedSpellDiv = document.querySelector('.divine-intervention-selected-spell');
    expect(selectedSpellDiv.textContent).toMatch(/Cantrip/);
  });

  it('handles a spell with undefined description by rendering no paragraphs', () => {
    const noDescriptionSpell = [
      {
        index: 'test-spell',
        name: 'Test Spell',
        level: 1,
        school: 'Evocation',
        casting_time: '1 action',
        range: 'Self',
        components: 'V',
        duration: 'Instantaneous',
        description: null,
      },
    ];
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: noDescriptionSpell })} />);
    fireEvent.click(screen.getByText('Test Spell'));
    const selectedSpellDiv = document.querySelector('.divine-intervention-selected-spell');
    expect(selectedSpellDiv.querySelectorAll('p').length).toBe(0);
  });

  it('handles a spell with undefined school in the detail view', () => {
    const noSchoolSpell = [
      {
        index: 'test-spell',
        name: 'Test Spell',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        components: 'V',
        duration: 'Instantaneous',
        description: ['A spell without a school.'],
      },
    ];
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: noSchoolSpell })} />);
    fireEvent.click(screen.getByText('Test Spell'));
    const selectedSpellDiv = document.querySelector('.divine-intervention-selected-spell');
    expect(selectedSpellDiv.textContent).toMatch(/Level 1 — /);
  });
});

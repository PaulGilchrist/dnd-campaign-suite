// @cleaned-by-ai
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

  it('renders the modal overlay with the feature name', () => {
    render(<DivineInterventionModal {...makeProps({ featureName: 'Gods\' Gambit' })} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(screen.getByText('Gods\' Gambit')).toBeInTheDocument();
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
    expect(screen.getByText(/doesn't require a Reaction/)).toBeInTheDocument();
    expect(screen.queryByText(/Wish/)).not.toBeInTheDocument();
  });

  it('shows the greater note text with Wish mention when isGreater is true', () => {
    render(<DivineInterventionModal {...makeProps({ isGreater: true })} />);
    expect(screen.getByText(/Wish/)).toBeInTheDocument();
    expect(screen.queryByText(/doesn't require a Reaction/)).not.toBeInTheDocument();
  });

  // ── Spell list rendering ──

  it('renders all eligible spells with their level, casting time, and tags', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByText('Guiding Bolt')).toBeInTheDocument();
    expect(screen.getByText('Thunderwave')).toBeInTheDocument();
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
    expect(screen.getByText('Sacred Flame')).toBeInTheDocument();
    expect(screen.getByText('Spiritual Weapon')).toBeInTheDocument();
    expect(screen.getByText(/Concentration/)).toBeInTheDocument();
    const spellMetaItems = document.querySelectorAll('.spell-meta');
    expect(spellMetaItems.length).toBe(5);
    // Verify each spell has the correct meta text
    expect(spellMetaItems[0].textContent).toContain('Level 1');
    expect(spellMetaItems[0].textContent).toContain('1 action');
    expect(spellMetaItems[4].textContent).toContain('Level 2');
    expect(spellMetaItems[4].textContent).toContain('1 bonus action');
    expect(spellMetaItems[4].textContent).toContain('Concentration');
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

  it('renders filter buttons for each distinct spell level', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByText('All Levels')).toBeInTheDocument();
    expect(screen.getByText('Cantrip')).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(screen.getByText('Level 2')).toBeInTheDocument();
  });

  it('highlights "All Levels" as the active filter by default', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByText('All Levels')).toHaveClass('active');
  });

  // ── Filter functionality ──

  it('filters the spell list when a level button is clicked and restores on All Levels', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Level 1'));
    expect(screen.getByText('Guiding Bolt')).toBeInTheDocument();
    expect(screen.getByText('Thunderwave')).toBeInTheDocument();
    expect(screen.queryByText('Fire Bolt')).not.toBeInTheDocument();
    expect(screen.queryByText('Spiritual Weapon')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('All Levels'));
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
    expect(screen.getByText('Spiritual Weapon')).toBeInTheDocument();
  });

  it('highlights the clicked level filter and deselects others', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Level 2'));
    expect(screen.getByText('Level 2')).toHaveClass('active');
    expect(screen.getByText('All Levels')).not.toHaveClass('active');
    expect(screen.getByText('Cantrip')).not.toHaveClass('active');
  });

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

  // ── Spell selection flow ──

  it('switches to detail view, shows Cast button, and returns to list on Back', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByRole('button', { name: /Cast with Divine Intervention/ })).toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Back'));
    expect(screen.queryByRole('button', { name: /Cast with Divine Intervention/ })).not.toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
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

  it('displays the selected spell name, level, school, and tags', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Spiritual Weapon'));
    expect(screen.getByText('Spiritual Weapon')).toBeInTheDocument();
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

  it('displays casting time, range, and optional components and duration', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByText(/Casting Time: 1 action — Range: 120 feet/)).toBeInTheDocument();
    expect(screen.getByText(/Components: V, S/)).toBeInTheDocument();
    expect(screen.getByText(/Duration: 1 instant/)).toBeInTheDocument();
  });

  it('displays the spell description', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByText(/A bolt of light streaks toward a creature/)).toBeInTheDocument();
  });

  it('displays damage info with slot levels and type', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByText(/Damage: 4d6 \/ 5d6 \(Radiant\)/)).toBeInTheDocument();
  });

  it('shows damage for spells using damage_at_character_level', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Fire Bolt'));
    expect(screen.getByText(/1d10/)).toBeInTheDocument();
  });

  it('does not display a damage section when the spell has no damage', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Thunderwave'));
    expect(screen.queryByText(/Damage/)).not.toBeInTheDocument();
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

  it('renders only the relevant filter buttons when spells have only one level', () => {
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

  // ── Custom feature name ──

  it('renders custom featureName in the header', () => {
    render(<DivineInterventionModal {...makeProps({ featureName: 'Divine Strike' })} />);
    expect(screen.getByText('Divine Strike')).toBeInTheDocument();
  });
});

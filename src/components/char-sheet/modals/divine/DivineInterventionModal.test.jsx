// @improved-by-ai
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

  it('renders the modal overlay with feature name, cancel button, and no cast button', () => {
    render(<DivineInterventionModal {...makeProps({ featureName: "Gods' Gambit" })} />);
    expect(screen.getByText("Gods' Gambit")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
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
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
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

  // ── Filter functionality ──

  it('renders filter buttons, highlights All Levels by default, filters spells, and restores on All Levels', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByText('All Levels')).toBeInTheDocument();
    expect(screen.getByText('Cantrip')).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(screen.getByText('Level 2')).toBeInTheDocument();
    expect(screen.getByText('All Levels')).toHaveClass('active');

    fireEvent.click(screen.getByText('Level 1'));
    expect(screen.getByText('Level 1')).toHaveClass('active');
    expect(screen.getByText('All Levels')).not.toHaveClass('active');
    expect(screen.getByText('Cantrip')).not.toHaveClass('active');
    expect(screen.getByText('Guiding Bolt')).toBeInTheDocument();
    expect(screen.getByText('Thunderwave')).toBeInTheDocument();
    expect(screen.queryByText('Fire Bolt')).not.toBeInTheDocument();
    expect(screen.queryByText('Spiritual Weapon')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('All Levels'));
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
    expect(screen.getByText('Spiritual Weapon')).toBeInTheDocument();
  });

  it('renders dynamic filter buttons for high-level spells', () => {
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
    expect(screen.queryByText('Cantrip')).not.toBeInTheDocument();
    expect(screen.queryByText('Level 1')).not.toBeInTheDocument();
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

  it('switches to detail view with Cast button, preserves active filter on Back, and restores list', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Level 1'));
    expect(screen.getByText('Level 1')).toHaveClass('active');

    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByRole('button', { name: /Cast with Divine Intervention/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByText('Thunderwave')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Back'));
    expect(screen.queryByRole('button', { name: /Cast with Divine Intervention/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByText('Thunderwave')).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toHaveClass('active');
  });

  // ── Selected spell detail view ──

  it('displays spell header with level, school, concentration, and ritual tags', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Spiritual Weapon'));
    expect(screen.getByRole('heading', { name: 'Spiritual Weapon' })).toBeInTheDocument();
    expect(screen.getByText(/Level 2 — Evocation — Concentration/)).toBeInTheDocument();
  });

  it('displays ritual spell header with ritual tag instead of concentration', () => {
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

  it('omits components and duration when the spell has no components or duration', () => {
    const minimalSpell = [
      {
        index: 'minion',
        name: 'Minion',
        level: 1,
        school: 'Evocation',
        casting_time: '1 action',
        range: '60 feet',
        description: ['A simple spell.'],
      },
    ];
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: minimalSpell })} />);
    fireEvent.click(screen.getByText('Minion'));
    expect(screen.getByText(/Casting Time: 1 action — Range: 60 feet/)).toBeInTheDocument();
    expect(screen.queryByText(/Components/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Duration/)).not.toBeInTheDocument();
  });

  it('displays the spell description', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByText(/A bolt of light streaks toward a creature/)).toBeInTheDocument();
  });

  // ── Damage display ──

  it('displays damage info for slot-level and character-level spells, and omits it when absent', () => {
    render(<DivineInterventionModal {...makeProps()} />);

    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByText(/Damage: 4d6 \/ 5d6 \(Radiant\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back'));
    fireEvent.click(screen.getByText('Fire Bolt'));
    expect(screen.getByText(/Damage: 1d10 \(Fire\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back'));
    fireEvent.click(screen.getByText('Thunderwave'));
    expect(screen.queryByText(/Damage/)).not.toBeInTheDocument();
  });

  // ── Cast button ──

  it('calls onSelect with the selected spell when Cast is clicked', () => {
    const props = makeProps();
    render(<DivineInterventionModal {...props} />);
    fireEvent.click(screen.getByText('Spiritual Weapon'));
    fireEvent.click(screen.getByRole('button', { name: /Cast with Divine Intervention/ }));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(props.onSelect).toHaveBeenCalledWith(baseSpells[4]);
  });

  // ── Close / dismiss behavior ──

  it('calls onClose when Cancel is clicked', () => {
    const props = makeProps();
    render(<DivineInterventionModal {...props} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking the overlay background outside the modal content', () => {
    const props = makeProps();
    render(<DivineInterventionModal {...props} />);
    const overlay = document.querySelector('.sp-overlay');
    expect(overlay).toBeInTheDocument();
    fireEvent.click(overlay);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does not close when clicking inside the modal content', () => {
    const props = makeProps();
    render(<DivineInterventionModal {...props} />);
    const modal = document.querySelector('.sp-modal');
    expect(modal).toBeInTheDocument();
    fireEvent.click(modal);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  // ── Empty spell list ──

  it('shows "No spells found" when eligibleSpells is empty', () => {
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: [] })} />);
    expect(screen.getByText(/No spells found for this level/)).toBeInTheDocument();
  });

  it('renders only relevant filter buttons when spells have only one level', () => {
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
});

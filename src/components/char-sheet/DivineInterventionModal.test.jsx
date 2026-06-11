import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DivineInterventionModal from './DivineInterventionModal.jsx';

// ── Test fixtures ──

const mockOnSelect = vi.fn();
const mockOnClose = vi.fn();

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
    onSelect: mockOnSelect,
    onClose: mockOnClose,
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('DivineInterventionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering with props ──

  it('renders the modal overlay', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders the header with featureName', () => {
    render(<DivineInterventionModal {...makeProps({ featureName: 'Gods\' Gambit' })} />);
    expect(screen.getByText('Gods\' Gambit')).toBeInTheDocument();
  });

  it('renders a star icon in the header', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    const icon = document.querySelector('.fa-star-of-life');
    expect(icon).toBeInTheDocument();
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

  it('renders spell level and casting time for each spell', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/Level 1/);
    expect(bodyDiv.textContent).toMatch(/Cantrip/);
    expect(bodyDiv.textContent).toMatch(/Level 2 — 1 bonus action/);
  });

  it('renders concentration tag for spells with concentration', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByText(/Concentration/)).toBeInTheDocument();
  });

  // ── Level filter buttons ──

  it('renders an "All Levels" filter button', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByText('All Levels')).toBeInTheDocument();
  });

  it('renders a filter button for each spell level', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByText('Cantrip')).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(screen.getByText('Level 2')).toBeInTheDocument();
  });

  it('highlights the active filter button', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    const allLevelsBtn = screen.getByText('All Levels');
    expect(allLevelsBtn).toHaveClass('active');
  });

  // ── Filter functionality ──

  it('filters spells when a level button is clicked', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Level 1'));
    expect(screen.getByText('Guiding Bolt')).toBeInTheDocument();
    expect(screen.getByText('Thunderwave')).toBeInTheDocument();
    expect(screen.queryByText('Fire Bolt')).not.toBeInTheDocument();
    expect(screen.queryByText('Spiritual Weapon')).not.toBeInTheDocument();
  });

  it('shows all spells when "All Levels" is clicked after filtering', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Level 1'));
    fireEvent.click(screen.getByText('All Levels'));
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
    expect(screen.getByText('Spiritual Weapon')).toBeInTheDocument();
  });

  it('highlights the selected level filter button', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Level 2'));
    const level2Btn = screen.getByText('Level 2');
    expect(level2Btn).toHaveClass('active');
    const allLevelsBtn = screen.getByText('All Levels');
    expect(allLevelsBtn).not.toHaveClass('active');
  });

  // ── Spell selection ──

  it('shows selected spell details when a spell is clicked', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByText('Guiding Bolt')).toBeInTheDocument();
  });

  it('hides filter buttons and spell list after selecting a spell', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.queryByText('All Levels')).not.toBeInTheDocument();
  });

  // ── Selected spell detail view ──

  it('displays the selected spell name', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Spiritual Weapon'));
    expect(screen.getByText('Spiritual Weapon')).toBeInTheDocument();
  });

  it('displays level, school, concentration, and ritual tags', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Spiritual Weapon'));
    expect(screen.getByText(/Level 2 — Evocation — Concentration/)).toBeInTheDocument();
  });

  it('displays casting time, range, components, and duration', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByText(/Casting Time: 1 action — Range: 120 feet/)).toBeInTheDocument();
    expect(screen.getByText(/Components: V, S/)).toBeInTheDocument();
    expect(screen.getByText(/Duration: 1 instant/)).toBeInTheDocument();
  });

  it('displays spell description', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByText(/A bolt of light streaks toward a creature/)).toBeInTheDocument();
  });

  it('displays damage info when present', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    const selectedSpellDiv = document.querySelector('.divine-intervention-selected-spell');
    expect(selectedSpellDiv.textContent).toMatch(/Damage:/);
    expect(selectedSpellDiv.textContent).toMatch(/4d6/);
    expect(selectedSpellDiv.textContent).toMatch(/Radiant/);
  });

  it('does not display damage section when spell has no damage', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Thunderwave'));
    expect(screen.queryByText(/Damage:/)).not.toBeInTheDocument();
  });

  // ── Cast button ──

  it('calls onSelect with selected spell when Cast is clicked', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    fireEvent.click(screen.getByRole('button', { name: /Cast with Divine Intervention/ }));
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(baseSpells[0]);
  });

  // ── Back button ──

  it('clears selection when Back is clicked', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByRole('button', { name: /Cast with Divine Intervention/ })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.queryByRole('button', { name: /Cast with Divine Intervention/ })).not.toBeInTheDocument();
    expect(screen.getByText('All Levels')).toBeInTheDocument();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel is clicked', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // ── Overlay click ──

  it('calls onClose when clicking the overlay background', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when clicking inside the modal', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    const modal = document.querySelector('.sp-modal');
    fireEvent.click(modal);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  // ── isGreater note text ──

  it('shows Wish mention when isGreater is true', () => {
    render(<DivineInterventionModal {...makeProps({ isGreater: true })} />);
    expect(screen.getByText(/Wish/)).toBeInTheDocument();
  });

  it('does NOT show Wish mention when isGreater is false', () => {
    render(<DivineInterventionModal {...makeProps({ isGreater: false })} />);
    expect(screen.queryByText(/Wish/)).not.toBeInTheDocument();
  });

  it('shows Reaction restriction note when isGreater is false', () => {
    render(<DivineInterventionModal {...makeProps({ isGreater: false })} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/doesn't require a Reaction/);
  });

  it('does NOT show Reaction restriction note when isGreater is true', () => {
    render(<DivineInterventionModal {...makeProps({ isGreater: true })} />);
    expect(screen.queryByText(/doesn&apos;t require a Reaction/)).not.toBeInTheDocument();
  });

  // ── Empty spell list after filter ──

  it('shows "No spells found" message when eligibleSpells is empty', () => {
    render(<DivineInterventionModal {...makeProps({ eligibleSpells: [] })} />);
    expect(screen.getByText(/No spells found for this level/)).toBeInTheDocument();
  });

  // ── Spell with no damage ──

  it('does not show any damage section for a spell without damage', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Thunderwave'));
    const selectedSpellDiv = document.querySelector('.divine-intervention-selected-spell');
    expect(selectedSpellDiv.textContent).not.toMatch(/Damage/);
  });

  // ── Ritual tag ──

  it('renders ritual tag for a ritual spell', () => {
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
    expect(screen.getByText(/Ritual/)).toBeInTheDocument();
  });

  // ── Cantrip label ──

  it('shows "Cantrip" instead of "Level 0" in spell list', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/Cantrip — 1 action/);
  });

  it('shows "Cantrip" instead of "Level 0" in selected spell detail', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Fire Bolt'));
    const selectedSpellDiv = document.querySelector('.divine-intervention-selected-spell');
    expect(selectedSpellDiv.textContent).toMatch(/Cantrip/);
  });

  // ── Cast button not shown before selection ──

  it('shows Cancel button instead of Cast when no spell is selected', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cast with Divine Intervention/ })).not.toBeInTheDocument();
  });

  // ── Cast button shown after selection ──

  it('shows Cast button after selecting a spell', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByRole('button', { name: /Cast with Divine Intervention/ })).toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  // ── Multiple damage slot levels ──

  it('shows all damage slot levels joined with slashes', () => {
    render(<DivineInterventionModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(screen.getByText(/Damage: 4d6 \/ 5d6 \(Radiant\)/)).toBeInTheDocument();
  });
});

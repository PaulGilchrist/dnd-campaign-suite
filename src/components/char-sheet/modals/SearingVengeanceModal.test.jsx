// @maintained-by-ai
// SearingVengeanceModal is a thin props adapter over shared/CreatureSelectionModal.jsx
// (selection, gating, and map-overlay behavior are covered by shared/CreatureSelectionModal.test.jsx).
// This file pins what is unique to this seam: the hardcoded Searing Vengeance copy (verified
// against public/data/2024/classes.json), the `creatureTargets || []` guard, and the confirm/skip
// payloads emitted through the REAL shared modal (no mock — ZealousPresenceModal precedent).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SearingVengeanceModal from './SearingVengeanceModal';

const mockTargets = [
  { name: 'Enemy1', type: 'npc', currentHp: 20, maxHp: 30 },
  { name: 'Enemy2', type: 'npc', currentHp: 10, maxHp: 25 },
  'Enemy3',
];

function makeProps(overrides) {
  return {
    creatureTargets: mockTargets,
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
    ...(overrides || {}),
  };
}

const checkbox = (name) => screen.getByRole('checkbox', { name: new RegExp(name) });

describe('SearingVengeanceModal', () => {
  let props;

  beforeEach(() => {
    props = makeProps();
  });

  it('renders the full Searing Vengeance configuration', () => {
    const { container } = render(<SearingVengeanceModal {...props} />);

    expect(screen.getByText('Searing Vengeance')).toBeInTheDocument();
    expect(container.querySelector('.sp-header i.fa-solid.fa-fire')).toBeInTheDocument();
    expect(screen.getByText(
      'Select creatures within 30 feet to unleash radiant energy upon.'
    )).toBeInTheDocument();
    expect(screen.getByText(
      'Each selected creature takes 2d8 + Charisma modifier Radiant damage and is Blinded until end of your turn.'
    )).toBeInTheDocument();
    ['Enemy1', 'Enemy2', 'Enemy3'].forEach((name) => {
      expect(checkbox(name)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Unleash Vengeance/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('emits exactly the selected target names on confirm and stays inert while empty', () => {
    render(<SearingVengeanceModal {...props} />);

    const confirm = screen.getByRole('button', { name: 'Unleash Vengeance (0)' });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(props.onConfirm).not.toHaveBeenCalled();

    fireEvent.click(checkbox('Enemy1'));
    fireEvent.click(checkbox('Enemy3'));
    fireEvent.click(screen.getByRole('button', { name: 'Unleash Vengeance (2)' }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith(['Enemy1', 'Enemy3']);
    expect(props.onSkip).not.toHaveBeenCalled();
  });

  it('fires onSkip once without confirming', () => {
    render(<SearingVengeanceModal {...props} />);

    fireEvent.click(checkbox('Enemy1'));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('renders the empty-target state when creatureTargets is null', () => {
    render(<SearingVengeanceModal {...makeProps({ creatureTargets: null })} />);

    expect(screen.getByText('No targets available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unleash Vengeance (0)' })).toBeDisabled();
  });
});

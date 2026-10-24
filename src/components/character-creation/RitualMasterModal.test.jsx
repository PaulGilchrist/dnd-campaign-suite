// @maintained-by-ai
// RitualMasterModal BODY lane (fix#362, ledger :622 rec #394): the first and
// only lane for this host — pins the ritual filter (:18-21, level 1 AND
// ritual===true only) and the save contract (:30-39, exactly proficiencyBonus,
// fresh copy via onArrayFieldChange, close) + the pre-selection seed (:10-14).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RitualMasterModal from './RitualMasterModal.jsx';

vi.mock('../../services/ui/sanitize.js', () => ({
  renderMarkdown: vi.fn((md) => `<p>${md}</p>`),
}));

const spell = (name, level, ritual) => ({
  name, level, ritual, description: [`${name} text`], school: 'Divination', components: ['V'],
});
const SPELLS = [
  spell('Detect Magic', 1, true),
  spell('Identify', 1, true),
  spell('Burning Hands', 1, false),
  spell('Gentle Repose', 1, true),
  spell('Revivify', 3, true),
];

// charLevel 5 → proficiencyBonus floor((5-1)/4)+2 = 3 (:7-8).
const renderModal = (formData = { level: '5', ritualMasterSpells: [] }) => {
  const props = { formData, allSpells: SPELLS, onArrayFieldChange: vi.fn(), onClose: vi.fn() };
  render(<RitualMasterModal {...props} />);
  return props;
};

describe('RitualMasterModal', () => {
  it('lists ONLY level 1 ritual spells and states the proficiency-bonus budget', () => {
    renderModal();
    expect(screen.getByText('Detect Magic')).toBeInTheDocument();
    expect(screen.getByText('Identify')).toBeInTheDocument();
    expect(screen.getByText('Gentle Repose')).toBeInTheDocument();
    expect(screen.queryByText('Burning Hands')).not.toBeInTheDocument();
    expect(screen.queryByText('Revivify')).not.toBeInTheDocument();
    expect(screen.getByText('Level 1 Ritual Spells (0/3):')).toBeInTheDocument();
  });

  it('save posts the chosen set as a fresh copy via onArrayFieldChange and closes', () => {
    const props = renderModal({ level: '5', ritualMasterSpells: ['Identify'] });
    fireEvent.click(screen.getByText('Detect Magic'));
    fireEvent.click(screen.getByText('Gentle Repose'));
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(props.onArrayFieldChange).toHaveBeenCalledWith('ritualMasterSpells', ['Identify', 'Detect Magic', 'Gentle Repose']);
    expect(props.onArrayFieldChange.mock.calls[0][1]).not.toBe(props.formData.ritualMasterSpells);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('wrong count refuses: loud inline error, zero writes, stays open — completing the quota then saves', () => {
    const props = renderModal();
    fireEvent.click(screen.getByText('Detect Magic'));
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(screen.getByText('Choose exactly 3 level 1 spells with the Ritual tag (you have 1)')).toBeInTheDocument();
    expect(props.onArrayFieldChange).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Identify'));
    fireEvent.click(screen.getByText('Gentle Repose'));
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(screen.queryByText(/Choose exactly/)).not.toBeInTheDocument();
    expect(props.onArrayFieldChange).toHaveBeenCalledWith('ritualMasterSpells', ['Detect Magic', 'Identify', 'Gentle Repose']);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

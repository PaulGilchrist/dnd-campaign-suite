// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardStepRace from './WizardStepRace.jsx';
import races5e from '../../../public/data/races.json';
import races2024 from '../../../public/data/2024/races.json';

// Disk anchors — verbatim public/data/races.json and public/data/2024/races.json
// (verified 2026-10-18). The wizard passes these exact files in per ruleset via
// useWizardData, and racesData/allRacesData are the same file (so "missing
// section" fallbacks are unreachable in production and are not mocked here).
const ELF_5E = races5e.find(r => r.name === 'Elf');
const ELF_2024 = races2024.find(r => r.name === 'Elf');

function renderStep({ formData, racesData = races5e, allRacesData = racesData, ruleset = '5e', errors = {} } = {}) {
  const onInputChange = vi.fn();
  render(
    <WizardStepRace
      stepNumber={3}
      formData={formData ?? { race: { name: '', subrace: { name: '' } } }}
      errors={errors}
      racesData={racesData}
      allRacesData={allRacesData}
      ruleset={ruleset}
      onInputChange={onInputChange}
    />
  );
  return { onInputChange };
}

const optionTexts = () => screen.getAllByRole('option').map(o => o.textContent);

describe('WizardStepRace', () => {
  it('lists every 5e race from disk as an ordered option, unselected, with no detail card', () => {
    renderStep();
    expect(screen.getByText('Race *')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(optionTexts()).toEqual(['Select a race', ...races5e.map(r => r.name)]);
    expect(screen.queryByText(/Details/)).not.toBeInTheDocument();
  });

  it('selecting a race reports ("race", { name, subrace reset }) — child cascade lives here, subrace options live in the Subrace step', () => {
    const { onInputChange } = renderStep();
    // Elf owns subraces on disk (High Elf / Wood Elf / Dark Elf); selecting it
    // must still hand the wizard a blank subrace slot.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Elf' } });
    expect(onInputChange).toHaveBeenCalledTimes(1);
    expect(onInputChange).toHaveBeenCalledWith('race', { name: 'Elf', subrace: { name: '' } });
  });

  it.each([
    ['formData.race is null', { race: null }],
    ['the selected name is not in racesData', { race: { name: 'Aasimar', subrace: { name: '' } } }],
  ])('mounts no detail card when %s (Aasimar is on 2024 disk only)', (_label, formData) => {
    renderStep({ formData });
    expect(screen.queryByText(/Details/)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows the detail card collapsed and toggles its body via the button and the header', () => {
    renderStep({ formData: { race: { name: 'Elf', subrace: { name: '' } } } });
    const header = screen.getByRole('heading', { name: /Elf Details/i });
    const toggle = screen.getByRole('button', { name: 'Show Details' });
    expect(screen.queryByText('Core Information')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent('Hide Details');
    expect(screen.getByText('Core Information')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent('Show Details');
    expect(screen.queryByText('Core Information')).not.toBeInTheDocument();

    fireEvent.click(header);
    expect(screen.getByText('Core Information')).toBeInTheDocument();
  });

  it('renders the expanded 5e Elf detail card verbatim from disk: description, speed/size/languages, all traits', () => {
    renderStep({ formData: { race: { name: 'Elf', subrace: { name: '' } } } });
    fireEvent.click(screen.getByRole('button', { name: 'Show Details' }));

    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText(ELF_5E.description)).toBeInTheDocument();
    expect(screen.getByText('Core Information')).toBeInTheDocument();
    expect(screen.getByText('30 ft.')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Languages')).toBeInTheDocument();
    expect(screen.getByText('Common, Elvish')).toBeInTheDocument();

    expect(screen.getByText('Racial Traits')).toBeInTheDocument();
    for (const trait of ELF_5E.traits) {
      expect(screen.getByText(trait.name)).toBeInTheDocument();
      expect(screen.getByText(trait.description)).toBeInTheDocument();
    }
  });

  it('renders 2024 ruleset races from disk, with HTML descriptions rendered instead of escaped', () => {
    renderStep({
      ruleset: '2024',
      racesData: races2024,
      formData: { race: { name: 'Elf', subrace: { name: '' } } },
    });
    expect(optionTexts()).toEqual(['Select a race', ...races2024.map(r => r.name)]);

    fireEvent.click(screen.getByRole('button', { name: 'Show Details' }));
    expect(screen.getByText('30 ft.')).toBeInTheDocument();
    expect(screen.getByText(ELF_2024.size)).toBeInTheDocument();
    expect(screen.getByText('Common, Elvish')).toBeInTheDocument();

    // 2024 disk descriptions/traits embed real HTML (<p>, <br/>, <table>) —
    // the prose must render, raw tags must not leak as text.
    expect(screen.getByText(/^Created by the god Corellon, the first elves could change their forms at will\./)).toBeInTheDocument(); // first sentence of ELF_2024.description, verbatim
    const lineage = ELF_2024.traits.find(t => t.name === 'Elfish Lineage');
    expect(lineage.description).toContain('<'); // disk fact: this trait carries HTML
    expect(screen.getByText(/You are part of a lineage that grants you supernatural abilities/)).toBeInTheDocument();
    expect(screen.queryByText(/<table/)).not.toBeInTheDocument();
    for (const trait of ELF_2024.traits) {
      expect(screen.getByText(trait.name)).toBeInTheDocument();
    }
  });

  it('renders the placeholder-only select with no card while races are still loading (empty racesData)', () => {
    renderStep({ racesData: [] });
    expect(screen.getByText('Step 3: Race')).toBeInTheDocument();
    expect(optionTexts()).toEqual(['Select a race']);
    expect(screen.queryByText(/Details/)).not.toBeInTheDocument();
  });
});

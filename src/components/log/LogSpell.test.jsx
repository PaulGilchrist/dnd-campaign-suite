import { screen, cleanup } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { spell, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  describe('SpellEntry', () => {
    it('renders core header: Cast + spellName, characterName, level, casting time, and wand icon', () => {
      setup(Log, [spell()]);
      expect(screen.getByText(/Cast Fireball/i)).toBeInTheDocument();
      expect(screen.getByText(/Gandalf/i)).toBeInTheDocument();
      expect(screen.getByText(/Level 3/i)).toBeInTheDocument();
      expect(screen.getByText(/Action/i)).toBeInTheDocument();
      expect(q('.log-spell')).toBeInTheDocument();
      expect(q('.log-spell i.fa-wand-magic-sparkles')).toBeInTheDocument();
    });

    it('renders target name or multiple targets and omits them when absent', () => {
      setup(Log, [spell({ targetName: 'Orc' })]);
      expect(screen.getByText(/→ Orc/i)).toBeInTheDocument();

      cleanup();
      setup(Log, [spell({ targets: ['Orc', 'Goblin', 'Skeleton'] })]);
      expect(screen.getByText(/→ Orc, Goblin, Skeleton/i)).toBeInTheDocument();

      cleanup();
      setup(Log, [spell({ targetName: '' })]);
      expect(screen.queryByText(/→ /i)).not.toBeInTheDocument();

      cleanup();
      setup(Log, [spell({ targets: [] })]);
      expect(screen.queryByText(/→ /i)).not.toBeInTheDocument();
    });

    it('renders damage formula and type, omits when absent', () => {
      setup(Log, [spell({ damageFormula: '8d6', damageType: 'fire' })]);
      expect(screen.getByText(/8d6 fire/i)).toBeInTheDocument();

      cleanup();
      setup(Log, [spell({ damageFormula: '', damageType: '' })]);
      expect(q('.log-damage')).not.toBeInTheDocument();
    });

    it('renders save DC and omits when absent', () => {
      setup(Log, [spell({ saveDC: 15 })]);
      expect(screen.getByText(/Save DC 15/i)).toBeInTheDocument();

      cleanup();
      setup(Log, [spell({ saveDC: null })]);
      expect(q('.log-save-dc')).not.toBeInTheDocument();
    });

    it('renders concentration indicator and omits when absent', () => {
      setup(Log, [spell({ concentration: true })]);
      expect(screen.getByText(/Concentration/i)).toBeInTheDocument();
      expect(q('.log-concentration i.fa-link')).toBeInTheDocument();

      cleanup();
      setup(Log, [spell({ concentration: false })]);
      expect(q('.log-concentration')).not.toBeInTheDocument();
    });

    it('renders description with dangerouslySetInnerHTML and omits when absent', () => {
      setup(Log, [spell({ description: '<p>A bright flare streaks down</p>' })]);
      expect(q('.log-spell-description')).toBeInTheDocument();
      expect(q('.log-spell-description')).toHaveTextContent(/A bright flare/i);

      cleanup();
      setup(Log, [spell({ description: '' })]);
      expect(q('.log-spell-description')).not.toBeInTheDocument();
    });

    it('renders "No Metamagic" when array is empty', () => {
      setup(Log, [spell({ metamagic: [] })]);
      expect(screen.getByText(/No Metamagic/i)).toBeInTheDocument();
    });

    it('renders metamagic list, individual options, and SP cost when present; hides cost when zero', () => {
      setup(Log, [spell({ metamagic: ['Empowered'], spCost: 2 })]);
      expect(q('.log-metamagic-list')).toBeInTheDocument();
      expect(q('.log-metamagic-option')).toBeInTheDocument();
      expect(q('.log-metamagic-option')).toHaveTextContent(/Empowered/i);
      expect(q('.log-metamagic-cost')).toBeInTheDocument();
      expect(screen.getByText(/2 SP/i)).toBeInTheDocument();

      cleanup();
      setup(Log, [spell({ metamagic: ['Empowered'], spCost: 0 })]);
      expect(q('.log-metamagic-cost')).not.toBeInTheDocument();
    });

    it('renders multiple metamagics as separate items', () => {
      setup(Log, [spell({ metamagic: ['E', 'X', 'R'] })]);
      expect(document.querySelectorAll('.log-metamagic-option').length).toBe(3);
    });
  });

});

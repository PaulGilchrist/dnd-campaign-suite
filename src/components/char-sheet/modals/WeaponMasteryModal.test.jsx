// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WeaponMasteryModal from './WeaponMasteryModal.jsx';

vi.mock('../../../services/automation/handlers/combat/weaponMasteryHandler.js', () => ({
  MASTERY_EFFECTS: {
    Push: { label: 'Push (10 ft)', description: 'Push the creature up to 10 feet straight away from you.', effect: 'push', value: 10 },
    Topple: { label: 'Topple (Prone)', description: 'Force the creature to make a Constitution saving throw or fall Prone.', effect: 'topple', requiresSave: true, saveAbility: 'CON' },
    Sap: { label: 'Sap (Disadvantage)', description: 'The creature has Disadvantage on its next attack roll.', effect: 'disadvantage_next_attack' },
    Slow: { label: 'Slow (Speed -10 ft)', description: 'Reduce the creature\'s Speed by 10 feet.', effect: 'speed_reduction', value: 10 },
    Vex: { label: 'Vex (Advantage)', description: 'You have Advantage on your next attack roll.', effect: 'next_attack_advantage', value: 5 },
    Cleave: { label: 'Cleave (Extra Attack)', description: 'Make a melee attack roll with the weapon against a second creature.', effect: 'cleave' },
    Nick: { label: 'Nick (Extra Attack)', description: 'Make the extra attack of the Light property.', effect: 'nick' },
    Graze: { label: 'Graze (Miss Damage)', description: 'If your attack roll misses, deal damage equal to your ability modifier.', effect: 'graze' },
  },
  applyMasteryEffect: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  loadWeaponMasteries: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

import * as weaponMasteryHandler from '../../../services/automation/handlers/combat/weaponMasteryHandler.js';
import * as useActionPopup from '../../../hooks/combat/useActionPopup.js';
import * as damageUtils from '../../../services/rules/combat/damageUtils.js';

const mockPlayerStats = { name: 'Throg', level: 12, abilities: [{ name: 'CON', bonus: 3 }] };
const mockCampaignName = 'test-campaign';

function makeProps(overrides) {
  return {
    attackName: 'Longsword Attack',
    baseMastery: 'Vex',
    extraMasteries: ['Push'],
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    targetName: 'Goblin',
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

function renderModal(overrides) {
  useActionPopup.loadWeaponMasteries.mockResolvedValue([
    { name: 'Vex', description: 'Gain advantage on next attack.' },
    { name: 'Push', description: 'Push enemy 10 ft away.' },
  ]);
  damageUtils.getCombatContext.mockResolvedValue(null);
  return render(<WeaponMasteryModal {...makeProps(overrides)} />);
}

describe('WeaponMasteryModal', () => {

  // ── Rendering ──

  describe('initial render', () => {
    it('renders the modal overlay with header and body', () => {
      renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the attack name in the header', () => {
      renderModal();
      expect(screen.getByText(/Longsword Attack/)).toBeInTheDocument();
    });

    it('renders the Weapon Mastery title with crosshairs icon', () => {
      renderModal();
      expect(screen.getByText(/Weapon Mastery/)).toBeInTheDocument();
      expect(document.querySelector('.fa-solid.fa-crosshairs')).toBeInTheDocument();
    });

    it('renders the instruction text', () => {
      renderModal();
      expect(screen.getByText(/Choose a mastery property to activate/)).toBeInTheDocument();
    });

    it('renders the note about one mastery per hit', () => {
      renderModal();
      expect(screen.getByText(/You can activate one mastery property per hit/)).toBeInTheDocument();
    });
  });

  // ── Mastery list rendering ──

  describe('mastery options', () => {
    it('renders radio inputs for each mastery', () => {
      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(2);
    });

    it('renders the base mastery label', () => {
      renderModal();
      expect(screen.getByText(/Vex \(Advantage\)/)).toBeInTheDocument();
    });

    it('renders extra masteries from the extraMasteries prop', () => {
      renderModal();
      const labels = document.querySelectorAll('label');
      const pushLabel = Array.from(labels).find(l => l.textContent.includes('Push (10 ft)'));
      expect(pushLabel).toBeInTheDocument();
    });

    it('deduplicates a mastery appearing in both baseMastery and extraMasteries', () => {
      const props = makeProps();
      props.baseMastery = 'Vex';
      props.extraMasteries = ['Vex', 'Push'];
      render(<WeaponMasteryModal {...props} />);
      const labels = document.querySelectorAll('label');
      const vexLabels = Array.from(labels).filter(l => l.textContent.includes('Vex'));
      expect(vexLabels).toHaveLength(1);
    });

    it('marks feature-source masteries with a Feature badge', () => {
      renderModal();
      expect(screen.getByText('Feature')).toBeInTheDocument();
    });

    it('does not mark weapon-source masteries with a Feature badge', () => {
      const props = makeProps();
      props.extraMasteries = [];
      render(<WeaponMasteryModal {...props} />);
      const labels = document.querySelectorAll('label');
      const vexLabel = Array.from(labels).find(l => l.textContent.includes('Vex'));
      expect(vexLabel.querySelector('.automation-badge')).not.toBeInTheDocument();
    });

    it('falls back to mastery name when MASTERY_EFFECTS has no entry', () => {
      const props = makeProps();
      props.baseMastery = 'CustomMastery';
      props.extraMasteries = [];
      render(<WeaponMasteryModal {...props} />);
      expect(screen.getByText('CustomMastery')).toBeInTheDocument();
    });

    it('renders mastery descriptions loaded from loadWeaponMasteries', async () => {
      useActionPopup.loadWeaponMasteries.mockResolvedValue([
        { name: 'Vex', description: 'Custom Vex description.' },
        { name: 'Push', description: 'Custom Push description.' },
      ]);
      render(<WeaponMasteryModal {...makeProps()} />);
      await waitFor(() => {
        const bodyDiv = document.querySelector('.sp-body');
        expect(bodyDiv.textContent).toContain('Custom Vex description.');
        expect(bodyDiv.textContent).toContain('Custom Push description.');
      });
    });

    it('falls back to MASTERY_EFFECTS description when loadWeaponMasteries data is empty', () => {
      useActionPopup.loadWeaponMasteries.mockResolvedValue([]);
      renderModal();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
    });
  });

  // ── Selection behavior ──

  describe('mastery selection', () => {
    it('has no option selected initially', () => {
      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      radios.forEach(radio => expect(radio.checked).toBe(false));
    });

    it('selects a mastery when its radio is clicked', () => {
      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      expect(radios[0].checked).toBe(true);
    });

    it('deselects the previous option when a different one is selected', () => {
      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(radios[1]);
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });
  });

  // ── Activate button ──

  describe('activate button', () => {
    it('is disabled when no mastery is selected', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Activate/ })).toBeDisabled();
    });

    it('is enabled after selecting a mastery', () => {
      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      expect(screen.getByRole('button', { name: /Activate/ })).not.toBeDisabled();
    });

    it('is disabled when there are no masteries', () => {
      renderModal({ baseMastery: null, extraMasteries: [] });
      expect(screen.getByRole('button', { name: /Activate/ })).toBeDisabled();
    });

    it('has the sp-roll-btn class', () => {
      renderModal();
      const btn = screen.getByRole('button', { name: /Activate/ });
      expect(btn.classList.contains('sp-roll-btn')).toBe(true);
    });

    it('renders a crosshairs icon inside the button', () => {
      renderModal();
      const btn = screen.getByRole('button', { name: /Activate/ });
      expect(btn.querySelector('.fa-solid.fa-crosshairs')).toBeInTheDocument();
    });

    it('does not call applyMasteryEffect when activated with no selection', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      await waitFor(() => {
        expect(weaponMasteryHandler.applyMasteryEffect).not.toHaveBeenCalled();
      });
    });

    it('calls applyMasteryEffect with correct args when a mastery is selected and activated', async () => {
      weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Vex',
          description: 'Vex applied to target — you have Advantage on next attack.',
        },
      });

      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

      await waitFor(() => {
        expect(weaponMasteryHandler.applyMasteryEffect).toHaveBeenCalledTimes(1);
        const callArgs = weaponMasteryHandler.applyMasteryEffect.mock.calls[0];
        expect(callArgs[0]).toBe('Vex');
        expect(callArgs[1]).toBe(mockPlayerStats);
        expect(callArgs[2]).toBe(mockCampaignName);
      });
    });
  });

  // ── Applied state ──

  describe('applied state', () => {
    function setupAppliedState(result) {
      weaponMasteryHandler.applyMasteryEffect.mockResolvedValue(result);
      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
    }

    it('shows the result description after applying', async () => {
      setupAppliedState({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Vex',
          description: 'Vex applied to Goblin — you have Advantage on next attack.',
        },
      });
      await waitFor(() => {
        expect(screen.getByText(/Vex applied/)).toBeInTheDocument();
      });
    });

    it('renders the Done button in applied state', async () => {
      setupAppliedState({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Vex',
          description: 'Vex applied.',
        },
      });
      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
    });

    it('hides selection options after applying', async () => {
      setupAppliedState({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Vex',
          description: 'Vex applied.',
        },
      });
      await waitFor(() => {
        expect(screen.queryByText(/Choose a mastery property/)).not.toBeInTheDocument();
      });
    });

    it('hides the Activate button after applying', async () => {
      setupAppliedState({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Vex',
          description: 'Vex applied.',
        },
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Activate/ })).not.toBeInTheDocument();
      });
    });

    it('hides the Skip button after applying', async () => {
      setupAppliedState({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Vex',
          description: 'Vex applied.',
        },
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
      });
    });

    it('renders result payload description as HTML via dangerouslySetInnerHTML', async () => {
      setupAppliedState({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Vex',
          description: '<strong>Vex</strong> applied to Goblin.',
        },
      });
      await waitFor(() => {
        const bodyDiv = document.querySelector('.sp-body');
        expect(bodyDiv.innerHTML).toContain('<strong>Vex</strong>');
      });
    });

    it('does not show applied state when result is null', async () => {
      weaponMasteryHandler.applyMasteryEffect.mockResolvedValue(null);
      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      await waitFor(() => {
        expect(screen.queryByText('Done')).not.toBeInTheDocument();
      });
    });

    it('shows the Done button with sp-roll-btn class in applied state', async () => {
      setupAppliedState({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Vex',
          description: 'Done.',
        },
      });
      await waitFor(() => {
        const doneBtn = screen.getByRole('button', { name: 'Done' });
        expect(doneBtn.classList.contains('sp-roll-btn')).toBe(true);
      });
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onClose when Done button is clicked in applied state', async () => {
      const onClose = vi.fn();
      weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Vex',
          description: 'Vex applied.',
        },
      });

      render(<WeaponMasteryModal {...makeProps({ onClose })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Done'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Skip button is clicked', () => {
      const onClose = vi.fn();
      render(<WeaponMasteryModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      render(<WeaponMasteryModal {...makeProps({ onClose })} />);
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      render(<WeaponMasteryModal {...makeProps({ onClose })} />);
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when clicking the overlay in applied state', async () => {
      const onClose = vi.fn();
      weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Vex',
          description: 'Vex applied.',
        },
      });

      render(<WeaponMasteryModal {...makeProps({ onClose })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });

      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT close when clicking inside modal in applied state', async () => {
      const onClose = vi.fn();
      weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Vex',
          description: 'Vex applied.',
        },
      });

      render(<WeaponMasteryModal {...makeProps({ onClose })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });

      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Skip button ──

  describe('skip button', () => {
    it('has the sp-dismiss-btn class', () => {
      renderModal();
      const btn = screen.getByRole('button', { name: 'Skip' });
      expect(btn.classList.contains('sp-dismiss-btn')).toBe(true);
    });
  });

  // ── Target name display ──

  describe('target name display', () => {
    it('shows target name in instruction when targetName is provided', async () => {
      renderModal();
      await waitFor(() => {
        const bodyDiv = document.querySelector('.sp-body');
        expect(bodyDiv.textContent).toContain('against');
        expect(bodyDiv.textContent).toContain('Goblin');
      });
    });

    it('shows target name from auto-detection when targetName is not provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Throg', targetName: 'Ogre' },
          { name: 'Ogre' },
        ],
      });
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ogre' });

      render(<WeaponMasteryModal
        attackName='Longsword Attack'
        baseMastery='Vex'
        extraMasteries={[]}
        playerStats={mockPlayerStats}
        campaignName={mockCampaignName}
        onClose={vi.fn()}
      />);

      await waitFor(() => {
        const bodyDiv = document.querySelector('.sp-body');
        expect(bodyDiv.textContent).toContain('Ogre');
      });
    });

    it('shows no target name when targetName is not provided and auto-detection returns null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      render(<WeaponMasteryModal
        attackName='Longsword Attack'
        baseMastery='Vex'
        extraMasteries={[]}
        playerStats={mockPlayerStats}
        campaignName={mockCampaignName}
        onClose={vi.fn()}
      />);

      await waitFor(() => {
        const bodyDiv = document.querySelector('.sp-body');
        expect(bodyDiv.textContent).toContain('Choose a mastery property to activate');
        expect(bodyDiv.textContent).not.toContain('against');
      });
    });
  });

  // ── Edge cases: empty/missing masteries ──

  describe('empty masteries', () => {
    it('renders with no masteries when baseMastery and extraMasteries are null', () => {
      renderModal({ baseMastery: null, extraMasteries: null });
      expect(screen.getByText(/Longsword Attack/)).toBeInTheDocument();
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(0);
    });

    it('renders with no masteries when baseMastery is null and extraMasteries is empty', () => {
      renderModal({ baseMastery: null, extraMasteries: [] });
      expect(screen.getByText(/Longsword Attack/)).toBeInTheDocument();
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(0);
    });
  });

  // ── Edge cases: single mastery source ──

  describe('single mastery source', () => {
    it('renders only base mastery when extraMasteries is empty', () => {
      renderModal({ extraMasteries: [] });
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(1);
    });

    it('renders only extra masteries when baseMastery is null', () => {
      renderModal({ baseMastery: null });
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(1);
      const labels = document.querySelectorAll('label');
      const pushLabel = Array.from(labels).find(l => l.textContent.includes('Push (10 ft)'));
      expect(pushLabel).toBeInTheDocument();
    });
  });

});

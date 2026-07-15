// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TacticalMasterModal from './TacticalMasterModal.jsx';

vi.mock('../../../services/automation/handlers/combat/weaponMasteryHandler.js', () => ({
  MASTERY_EFFECTS: {
    Push: { label: 'Push (10 ft)', description: 'Push the creature up to 10 feet straight away from you if it is Large or smaller.', effect: 'push', value: 10, sizeLimit: 'large_or_smaller' },
    Topple: { label: 'Topple (Prone)', description: 'Force the creature to make a Constitution saving throw or fall Prone.', effect: 'topple', requiresSave: true, saveAbility: 'CON' },
    Sap: { label: 'Sap (Disadvantage)', description: 'The creature has Disadvantage on its next attack roll before the start of your next turn.', effect: 'disadvantage_next_attack' },
    Slow: { label: 'Slow (Speed -10 ft)', description: "Reduce the creature's Speed by 10 feet until the start of your next turn.", effect: 'speed_reduction', value: 10 },
    Vex: { label: 'Vex (Advantage)', description: 'You have Advantage on your next attack roll against that creature before the end of your next turn.', effect: 'next_attack_advantage', value: 5, perTarget: true },
    Cleave: { label: 'Cleave (Extra Attack)', description: 'Make a melee attack roll with the weapon against a second creature within 5 feet of the first.', effect: 'cleave', oncePerTurn: true },
    Nick: { label: 'Nick (Extra Attack)', description: 'Make the extra attack of the Light property as part of the Attack action instead of as a Bonus Action.', effect: 'nick', oncePerTurn: true },
    Graze: { label: 'Graze (Miss Damage)', description: 'If your attack roll misses, deal damage equal to your ability modifier.', effect: 'graze' },
  },
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  loadWeaponMasteries: vi.fn(),
}));

import * as useActionPopup from '../../../hooks/combat/useActionPopup.js';

const mockPlayerStats = { name: 'Throg', level: 12, abilities: [{ name: 'CON', bonus: 3 }] };

function makeProps(overrides) {
  return {
    attackName: 'Longsword Attack',
    baseMastery: 'Vex',
    replaceOptions: ['Push'],
    targetName: 'Goblin',
    playerStats: mockPlayerStats,
    campaignName: 'test-campaign',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    isChoiceMode: false,
    ...(overrides || {}),
  };
}

function renderModal(overrides) {
  useActionPopup.loadWeaponMasteries.mockResolvedValue([
    { name: 'Vex', description: 'Gain advantage on next attack.' },
    { name: 'Push', description: 'Push enemy 10 ft away.' },
  ]);
  return render(<TacticalMasterModal {...makeProps(overrides)} />);
}

// ── Rendering ──

describe('TacticalMasterModal - initial render', () => {
  it('renders the modal overlay with header, body, and actions', () => {
    renderModal();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders "Tactical Master" in the header with crosshairs icon and attack name', () => {
    renderModal();
    expect(screen.getByText(/Tactical Master/)).toBeInTheDocument();
    expect(document.querySelector('.fa-solid.fa-crosshairs')).toBeInTheDocument();
    expect(screen.getByText(/Longsword Attack/)).toBeInTheDocument();
  });

  it('renders the instruction text about choosing mastery property', () => {
    renderModal();
    expect(screen.getByText(/Choose a mastery property/)).toBeInTheDocument();
  });

  it('renders the description paragraph about Push, Sap, Slow properties', () => {
    renderModal();
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toContain('Push');
    expect(bodyDiv.textContent).toContain('Sap');
    expect(bodyDiv.textContent).toContain('Slow');
  });

  it('renders the note about one mastery property per hit', () => {
    renderModal();
    expect(screen.getByText(/You can choose one mastery property per hit/)).toBeInTheDocument();
  });

  it('shows target name in instruction when targetName is provided', () => {
    renderModal();
    const bodyDiv = document.querySelector('.sp-body');
    const firstP = bodyDiv.querySelector('p');
    expect(firstP.textContent).toContain('Goblin');
  });

  it('does not show target name when targetName is null', () => {
    renderModal({ targetName: null });
    const bodyDiv = document.querySelector('.sp-body');
    const firstP = bodyDiv.querySelector('p');
    expect(firstP.textContent).toContain('Choose a mastery property');
    expect(firstP.textContent).not.toContain('Goblin');
  });
});

// ── Mastery list rendering ──

describe('TacticalMasterModal - mastery options', () => {
  it('renders radio inputs for each mastery option', () => {
    renderModal();
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    expect(radios).toHaveLength(2);
  });

  it('renders the base mastery label with its MASTERY_EFFECTS label', () => {
    renderModal();
    expect(screen.getByText(/Vex \(Advantage\)/)).toBeInTheDocument();
  });

  it('renders replace options from the replaceOptions prop', () => {
    renderModal();
    expect(screen.getByText(/Push \(10 ft\)/)).toBeInTheDocument();
  });

  it('deduplicates a mastery appearing in both baseMastery and replaceOptions', () => {
    const props = makeProps();
    props.baseMastery = 'Vex';
    props.replaceOptions = ['Vex', 'Push'];
    render(<TacticalMasterModal {...props} />);
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    const vexLabels = Array.from(radios).filter((_, i) => {
      const label = radios[i].closest('label');
      return label.textContent.includes('Vex');
    });
    expect(vexLabels).toHaveLength(1);
  });

  it('excludes Graze from replaceOptions', () => {
    const props = makeProps();
    props.baseMastery = 'Push';
    props.replaceOptions = ['Graze', 'Sap'];
    render(<TacticalMasterModal {...props} />);
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    expect(radios).toHaveLength(2);
    const grazeRadio = Array.from(radios).find(r => {
      const label = r.closest('label');
      return label.textContent.includes('Graze');
    });
    expect(grazeRadio).toBeUndefined();
  });

  it('marks feature-source masteries with a Feature badge', () => {
    renderModal();
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });

  it('does not mark weapon-source (baseMastery) masteries with a Feature badge', () => {
    const props = makeProps();
    props.replaceOptions = [];
    render(<TacticalMasterModal {...props} />);
    const labels = document.querySelectorAll('label');
    const vexLabel = Array.from(labels).find(l => l.textContent.includes('Vex'));
    expect(vexLabel.querySelector('.automation-badge')).not.toBeInTheDocument();
  });

  it('falls back to mastery name when MASTERY_EFFECTS has no entry', () => {
    const props = makeProps();
    props.baseMastery = 'CustomMastery';
    props.replaceOptions = [];
    render(<TacticalMasterModal {...props} />);
    expect(screen.getByText('CustomMastery')).toBeInTheDocument();
  });

  it('renders mastery descriptions loaded from loadWeaponMasteries', async () => {
    useActionPopup.loadWeaponMasteries.mockResolvedValue([
      { name: 'Vex', description: 'Custom Vex description.' },
      { name: 'Push', description: 'Custom Push description.' },
    ]);
    render(<TacticalMasterModal {...makeProps()} />);
    await waitFor(() => {
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.textContent).toContain('Custom Vex description.');
      expect(bodyDiv.textContent).toContain('Custom Push description.');
    });
  });

  it('falls back to MASTERY_EFFECTS description when loadWeaponMasteries data is empty', () => {
    useActionPopup.loadWeaponMasteries.mockResolvedValue([]);
    render(<TacticalMasterModal {...makeProps()} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toContain('You have Advantage');
  });

  it('falls back to MASTERY_EFFECTS description when loadWeaponMasteries returns null', async () => {
    useActionPopup.loadWeaponMasteries.mockResolvedValue(null);
    renderModal();
    await waitFor(() => {
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.textContent).toContain('Vex (Advantage)');
    });
  });
});

// ── Selection behavior ──

describe('TacticalMasterModal - mastery selection', () => {
  it('has the baseMastery option selected initially', () => {
    renderModal();
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    expect(radios[0].checked).toBe(true);
  });

  it('selects a mastery when its radio is clicked', () => {
    renderModal();
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    fireEvent.click(radios[0]);
    expect(radios[0].checked).toBe(true);
  });

  it('deselects the previous option when a different one is selected', () => {
    renderModal();
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    fireEvent.click(radios[0]);
    fireEvent.click(radios[1]);
    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
  });
});

// ── Apply button ──

describe('TacticalMasterModal - apply button', () => {
  it('is enabled when baseMastery is pre-selected', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /Apply/ })).not.toBeDisabled();
  });

  it('is disabled when there are no masteries', () => {
    renderModal({ baseMastery: null, replaceOptions: [] });
    expect(screen.getByRole('button', { name: /Apply/ })).toBeDisabled();
  });

  it('calls onConfirm with the selected mastery when a mastery is selected and apply is clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<TacticalMasterModal {...makeProps({ onConfirm })} />);
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith('Vex');
    });
  });

  it('calls onConfirm with the second mastery option when selected', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<TacticalMasterModal {...makeProps({ onConfirm })} />);
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    fireEvent.click(radios[1]);
    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('Push');
    });
  });
});

// ── Applied state ──

describe('TacticalMasterModal - applied state', () => {
  function setupAppliedState() {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<TacticalMasterModal {...makeProps({ onConfirm })} />);
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));
  }

  it('shows "Mastery applied successfully" message with Done button, hiding selection elements', async () => {
    setupAppliedState();
    await waitFor(() => {
      expect(screen.getByText(/Mastery applied successfully/)).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
      expect(screen.queryByText(/Choose a mastery property/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Apply/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
      expect(screen.queryByText(/You can choose one mastery property per hit/)).not.toBeInTheDocument();
    });
  });

  it('renders the Tactical Master header with crosshairs in applied state', async () => {
    setupAppliedState();
    await waitFor(() => {
      expect(screen.getByText(/Tactical Master/)).toBeInTheDocument();
      expect(document.querySelector('.fa-solid.fa-crosshairs')).toBeInTheDocument();
    });
  });
});

// ── Close behavior ──

describe('TacticalMasterModal - close behavior', () => {
  it('calls onClose when Done button is clicked in applied state', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<TacticalMasterModal {...makeProps({ onClose, onConfirm })} />);
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Skip button is clicked', () => {
    const onClose = vi.fn();
    render(<TacticalMasterModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Edge cases: empty/missing masteries ──

describe('TacticalMasterModal - empty masteries', () => {
  it('renders with no masteries when baseMastery and replaceOptions are null or empty', () => {
    renderModal({ baseMastery: null, replaceOptions: null });
    expect(screen.getByText(/Longsword Attack/)).toBeInTheDocument();
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    expect(radios).toHaveLength(0);
  });

  it('renders with no masteries when baseMastery is null and replaceOptions is empty', () => {
    renderModal({ baseMastery: null, replaceOptions: [] });
    expect(screen.getByText(/Longsword Attack/)).toBeInTheDocument();
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    expect(radios).toHaveLength(0);
  });
});

// ── Edge cases: single mastery source ──

describe('TacticalMasterModal - single mastery source', () => {
  it('renders only base mastery when replaceOptions is empty', () => {
    renderModal({ replaceOptions: [] });
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    expect(radios).toHaveLength(1);
  });

  it('renders only replace options when baseMastery is null', () => {
    renderModal({ baseMastery: null });
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    expect(radios).toHaveLength(1);
    const labels = document.querySelectorAll('label');
    const pushLabel = Array.from(labels).find(l => l.textContent.includes('Push (10 ft)'));
    expect(pushLabel).toBeInTheDocument();
  });
});

// ── Edge cases: replaceOptions with Graze only ──

describe('TacticalMasterModal - Graze-only replaceOptions', () => {
  it('excludes Graze from replaceOptions when it is the only option', () => {
    const props = makeProps();
    props.baseMastery = 'Push';
    props.replaceOptions = ['Graze'];
    render(<TacticalMasterModal {...props} />);
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    expect(radios).toHaveLength(1);
    const labels = Array.from(radios).map(r => r.closest('label').textContent);
    expect(labels.join('')).not.toContain('Graze');
  });
});

// ── Edge cases: duplicate mastery in base and replaceOptions ──

describe('TacticalMasterModal - duplicate masteries', () => {
  it('only shows a mastery once when it appears in both baseMastery and replaceOptions', () => {
    const props = makeProps();
    props.baseMastery = 'Push';
    props.replaceOptions = ['Push', 'Sap'];
    render(<TacticalMasterModal {...props} />);
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    expect(radios).toHaveLength(2);
  });
});

// ── Edge cases: all possible mastery effects ──

describe('TacticalMasterModal - all mastery effects', () => {
  it('renders all MASTERY_EFFECTS labels when they appear in options', () => {
    const props = makeProps();
    props.baseMastery = 'Push';
    props.replaceOptions = ['Topple', 'Sap', 'Slow', 'Vex', 'Cleave', 'Nick', 'Graze'];
    render(<TacticalMasterModal {...props} />);
    expect(screen.getByText(/Push \(10 ft\)/)).toBeInTheDocument();
    expect(screen.getByText(/Topple \(Prone\)/)).toBeInTheDocument();
    expect(screen.getByText(/Sap \(Disadvantage\)/)).toBeInTheDocument();
    expect(screen.getByText(/Slow \(Speed -10 ft\)/)).toBeInTheDocument();
    expect(screen.getByText(/Vex \(Advantage\)/)).toBeInTheDocument();
    expect(screen.getByText(/Cleave \(Extra Attack\)/)).toBeInTheDocument();
    expect(screen.getByText(/Nick \(Extra Attack\)/)).toBeInTheDocument();
  });

  it('excludes Graze even when it appears in replaceOptions alongside many others', () => {
    const props = makeProps();
    props.baseMastery = 'Push';
    props.replaceOptions = ['Topple', 'Sap', 'Slow', 'Vex', 'Cleave', 'Nick', 'Graze'];
    render(<TacticalMasterModal {...props} />);
    const radios = document.querySelectorAll('input[name="tacticalMasterOption"]');
    expect(radios).toHaveLength(7);
    const grazeRadio = Array.from(radios).find(r => {
      const label = r.closest('label');
      return label.textContent.includes('Graze');
    });
    expect(grazeRadio).toBeUndefined();
  });
});

// ── Effect label fallback ──

describe('TacticalMasterModal - effect label fallback', () => {
  it('uses MASTERY_EFFECTS label when available', () => {
    renderModal();
    expect(screen.getByText(/Vex \(Advantage\)/)).toBeInTheDocument();
  });

  it('falls back to mastery name when MASTERY_EFFECTS has no label entry', () => {
    const props = makeProps();
    props.baseMastery = 'UnknownMastery';
    props.replaceOptions = [];
    render(<TacticalMasterModal {...props} />);
    expect(screen.getByText('UnknownMastery')).toBeInTheDocument();
  });
});

// ── Description display priority ──

describe('TacticalMasterModal - description display', () => {
  it('uses loadWeaponMasteries description over MASTERY_EFFECTS description', async () => {
    useActionPopup.loadWeaponMasteries.mockResolvedValue([
      { name: 'Vex', description: 'Overridden Vex desc.' },
      { name: 'Push', description: 'Overridden Push desc.' },
    ]);
    render(<TacticalMasterModal {...makeProps()} />);
    await waitFor(() => {
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.textContent).toContain('Overridden Vex desc.');
      expect(bodyDiv.textContent).toContain('Overridden Push desc.');
    });
  });

  it('uses MASTERY_EFFECTS description when loadWeaponMasteries has no entry for a mastery', async () => {
    useActionPopup.loadWeaponMasteries.mockResolvedValue([
      { name: 'Push', description: 'Push desc from file.' },
    ]);
    render(<TacticalMasterModal {...makeProps()} />);
    await waitFor(() => {
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.textContent).toContain('Push desc from file.');
      // Vex should fall back to MASTERY_EFFECTS description
      expect(bodyDiv.textContent).toContain('You have Advantage');
    });
  });

  it('shows no description when both sources are missing', async () => {
    useActionPopup.loadWeaponMasteries.mockResolvedValue([]);
    const props = makeProps();
    props.baseMastery = 'UnknownMastery';
    props.replaceOptions = [];
    render(<TacticalMasterModal {...props} />);
    await waitFor(() => {
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.textContent).toContain('UnknownMastery');
    });
  });
});

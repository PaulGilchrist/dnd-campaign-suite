// @maintained-by-ai
// Label-set regression ledger for the .sp-modal rider-chooser footer family
// (2026-11-07 QA backlog: one shared footer API, labels byte-pinned).
// Every chooser face in the family must render its confirm/decline pair
// through ChooserModalFooter with CHOOSER_FOOTER_LABELS bytes — a rename
// here MUST be a deliberate re-bless, because live QA automation matches
// these exact strings (`Apply Effects`, `Apply Effect`, `Trip Secondary
// Target`, `Cancel`, `Skip (do not consume use)`).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChooserModalFooter from './ChooserModalFooter.jsx';
import { CHOOSER_FOOTER_LABELS } from './chooserFooterLabels.js';
import AttackRiderModal from './AttackRiderModal.jsx';
import ShieldBashChoiceModal from '../ShieldBashChoiceModal.jsx';
import OpenHandTechniqueModal from '../OpenHandTechniqueModal.jsx';

vi.mock('../../../../services/automation/handlers/combat/attackRiderHandler.js', () => ({
  applyRiderOption: vi.fn(),
  handle: vi.fn(),
}));
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../../../../services/automation/handlers/class-fighter-rogue/versatileTricksterHandler.js', () => ({
  applyVersatileTrickster: vi.fn(),
}));
vi.mock('../../../../services/combat/steps/features/shieldBash.js', () => ({
  applyShieldBashEffect: vi.fn(),
}));
vi.mock('../../../../services/automation/handlers/class-fighter-rogue/openHandTechniqueHandler.js', () => ({
  applyOpenHandTechnique: vi.fn(),
  handle: vi.fn(),
}));

import { applyRiderOption } from '../../../../services/automation/handlers/combat/attackRiderHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { applyShieldBashEffect } from '../../../../services/combat/steps/features/shieldBash.js';
import {
  makeProps, makeMultiSelectAction, selectSingleOption, clickApplySingle, defaultResult,
} from './AttackRiderModal.test-utils.js';

const L = CHOOSER_FOOTER_LABELS;

describe('chooserFooterLabels — canonical bytes', () => {
  it('pins every chooser-face label byte-identical to the pre-refactor modals', () => {
    expect(L).toEqual({
      applyEffect: 'Apply Effect',
      applyEffects: 'Apply Effects',
      tripSecondaryTarget: 'Trip Secondary Target',
      attackTarget: 'Attack Target',
      applyFear: 'Apply Fear',
      cancel: 'Cancel',
      skipNoConsumeUse: 'Skip (do not consume use)',
      paidCostCommittedTitle: 'Cost already committed — resolve the effect instead',
    });
  });
});

describe('ChooserModalFooter — shared pair mechanics', () => {
  it('renders the confirm+decline pair with .sp-actions/.sp-roll-btn/.sp-dismiss-btn and no inline styles', () => {
    render(
      <ChooserModalFooter
        confirmIcon="fa-bolt"
        confirmLabel={L.applyEffects}
        onConfirm={vi.fn()}
        confirmDisabled
        declineLabel={L.cancel}
        onDecline={vi.fn()}
      />
    );
    const actions = document.querySelector('.sp-actions');
    expect(actions).toBeInTheDocument();
    expect(actions.getAttribute('style')).toBeNull();
    const confirm = screen.getByRole('button', { name: L.applyEffects });
    const decline = screen.getByRole('button', { name: L.cancel });
    expect(confirm.className).toBe('sp-roll-btn');
    expect(decline.className).toBe('sp-dismiss-btn');
    expect(confirm.querySelector('i.fa-solid.fa-bolt')).toBeInTheDocument();
    expect(confirm).toBeDisabled();
    expect(decline).not.toBeDisabled();
    expect(decline.getAttribute('title')).toBeNull();
  });

  it('committed latch disables BOTH faces and explains the closed decline hatch via title', () => {
    const onConfirm = vi.fn();
    const onDecline = vi.fn();
    render(
      <ChooserModalFooter
        confirmLabel={L.applyEffect}
        onConfirm={onConfirm}
        declineLabel={L.cancel}
        onDecline={onDecline}
        committed
      />
    );
    const confirm = screen.getByRole('button', { name: L.applyEffect });
    const decline = screen.getByRole('button', { name: L.cancel });
    expect(confirm).toBeDisabled();
    expect(decline).toBeDisabled();
    expect(decline.getAttribute('title')).toBe(L.paidCostCommittedTitle);
    fireEvent.click(confirm);
    fireEvent.click(decline);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onDecline).not.toHaveBeenCalled();
  });
});

describe('chooser faces render their footers through the shared API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    applyRiderOption.mockResolvedValue(defaultResult);
    applyShieldBashEffect.mockResolvedValue(null);
  });

  it('AttackRiderModal single-select (Charge/DS singular face): Apply Effect + Cancel', () => {
    render(<AttackRiderModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: L.applyEffect })).toBeDisabled();
    expect(screen.getByRole('button', { name: L.cancel })).toBeInTheDocument();
    selectSingleOption('Burning Hands');
    expect(screen.getByRole('button', { name: L.applyEffect })).not.toBeDisabled();
  });

  it('AttackRiderModal multi-select (DS plural face): Apply Effects + Cancel', () => {
    render(<AttackRiderModal {...makeProps({ action: makeMultiSelectAction() })} />);
    expect(screen.getByRole('button', { name: L.applyEffects })).toBeDisabled();
    expect(screen.getByRole('button', { name: L.cancel })).toBeInTheDocument();
  });

  it('AttackRiderModal committed latch: Apply disables both faces with the paid-cost title on Cancel', async () => {
    let resolve;
    applyRiderOption.mockReturnValue(new Promise(r => { resolve = r; }));
    render(<AttackRiderModal {...makeProps({ onClose: vi.fn() })} />);
    selectSingleOption('Burning Hands');
    clickApplySingle();
    await waitFor(() => expect(applyRiderOption).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: L.applyEffect })).toBeDisabled();
    const cancel = screen.getByRole('button', { name: L.cancel });
    expect(cancel).toBeDisabled();
    expect(cancel.getAttribute('title')).toBe(L.paidCostCommittedTitle);
    resolve(defaultResult);
  });

  it('Versatile Trickster picker face: Trip Secondary Target confirm (Skip decline lives in SecondaryTargetModal)', async () => {
    getRuntimeValue.mockImplementation((charName, key) => {
      if (key === 'versatileTricksterSecondaryTargets') return [{ name: 'Orc A', size: 'Medium' }];
      if (key === 'versatileTricksterAction') return { name: 'Trip' };
      return null;
    });
    render(<AttackRiderModal {...makeProps()} />);
    selectSingleOption('Burning Hands');
    clickApplySingle();
    await waitFor(() => expect(screen.getByText('Versatile Trickster')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: L.tripSecondaryTarget })).toBeInTheDocument();
  });

  it("Stalker's Flurry picker faces: Attack Target / Apply Fear confirms", async () => {
    getRuntimeValue.mockImplementation((charName, key) => {
      if (key === 'stalkersFlurrySecondaryTargets') return [{ label: 'Creature A', value: 'Creature A' }];
      if (key === 'stalkersFlurryOptions') return ['Sudden Strike'];
      return null;
    });
    render(<AttackRiderModal {...makeProps()} />);
    selectSingleOption('Burning Hands');
    clickApplySingle();
    await waitFor(() => expect(screen.getByText("Stalker's Flurry")).toBeInTheDocument());
    expect(screen.getByRole('button', { name: L.attackTarget })).toBeInTheDocument();
  });

  it('ShieldBashChoiceModal: Apply Effect + Skip (do not consume use)', () => {
    render(
      <ShieldBashChoiceModal
        action={{ name: 'Shield Bash' }}
        playerStats={{ name: 'Fighter1' }}
        campaignName="test-campaign"
        targetName="Orc"
        saveDc={17}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: L.applyEffect })).toBeDisabled();
    expect(screen.getByRole('button', { name: L.skipNoConsumeUse })).toBeInTheDocument();
  });

  it('OpenHandTechniqueModal: Apply Effect + Cancel', () => {
    render(
      <OpenHandTechniqueModal
        action={{ name: 'Open Hand Technique', automation: { options: [{ name: 'Knock Down', effect: 'push_15ft' }] } }}
        playerStats={{ name: 'Monk1' }}
        campaignName="test-campaign"
        targetName="Goblin"
        saveDc={13}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: L.applyEffect })).toBeDisabled();
    expect(screen.getByRole('button', { name: L.cancel })).toBeInTheDocument();
  });
});

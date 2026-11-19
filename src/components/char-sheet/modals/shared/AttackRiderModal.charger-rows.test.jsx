// @maintained-by-ai
// MA 2026-11-18 backlog: the Charge Attack chooser rendered "Push 10 ft— Push 10 ft"
// (description echoed the label). Every option row must read `label — distinct
// explanation`; the explanation derives from the Charger feat rules text
// ("push the target up to 10 feet away if it is no more than one size larger
// than you") and the Damage Bonus row keeps its already-distinct "1d8 damage".
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AttackRiderModal from './AttackRiderModal.jsx';

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

import { applyRiderOption } from '../../../../services/automation/handlers/combat/attackRiderHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// Option bytes exactly as attackRollRiders.js feeds them for the 2024 Charger
// feat (public/data/2024/feats.json Charge Attack automation.effects via
// automationInfoBuilder/attack.js mapAutomationEffectOption/mapPushEffectOption).
const chargerAction = {
  name: 'Charge Attack',
  automation: {
    type: 'attack_rider',
    trigger: 'melee_hit_after_10ft_charge',
    chooseOne: true,
    oncePerTurn: true,
    maxEffects: 1,
    options: [
      { name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d8' },
      { name: 'Push 10 ft', effect: 'push', value: 10, sizeLimit: 'one_size_larger' },
    ],
  },
};

function makeChargerProps(overrides) {
  return {
    action: chargerAction,
    playerStats: { name: 'EvasiveFighter' },
    campaignName: 'test-campaign',
    targetName: 'Goblin',
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

function optionRows() {
  return [...document.querySelectorAll('.sp-body label')];
}

describe('AttackRiderModal Charge Attack chooser rows (label — distinct explanation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('renders the header and instruction as measured live on test-campaign', () => {
    render(<AttackRiderModal {...makeChargerProps()} />);
    expect(document.querySelector('.sp-header').textContent).toContain('Charge Attack');
    expect(document.querySelector('.sp-body p').textContent).toBe('Choose an effect against Goblin:');
  });

  it('pins each row to its exact rendered text — no label echo in the description', () => {
    render(<AttackRiderModal {...makeChargerProps()} />);
    const rows = optionRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toBe('Damage Bonus— 1d8 damage');
    expect(rows[1].textContent).toBe(
      'Push 10 ft— Push target 10 feet away from you (no more than one size larger than you)');
  });

  it('every row pairs its label with a description that is not a verbatim repeat', () => {
    render(<AttackRiderModal {...makeChargerProps()} />);
    for (const row of optionRows()) {
      const label = row.querySelector('strong').textContent;
      const desc = row.querySelector('span').textContent;
      expect(desc).toBeTruthy();
      expect(desc).not.toBe(label);
      expect(desc).not.toBe(`— ${label}`);
      expect(label).not.toContain(desc.replace(/^— /, ''));
    }
  });

  it('radios still gate Apply Effect and Apply/Cancel behavior is unchanged', async () => {
    const props = makeChargerProps();
    applyRiderOption.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Charge Attack', description: 'applied' },
    });
    render(<AttackRiderModal {...props} />);
    const apply = screen.getByRole('button', { name: /Apply Effect$/ });
    expect(apply).toBeDisabled();
    const pushRadio = optionRows()[1].querySelector('input[type="radio"]');
    expect(pushRadio.name).toBe('riderOption');
    fireEvent.click(pushRadio);
    expect(apply).not.toBeDisabled();
    fireEvent.click(apply);
    expect(applyRiderOption).toHaveBeenCalledWith(
      chargerAction, props.playerStats, 'test-campaign', 'Goblin', ['Push 10 ft']);
    // The result overlay mounts once the (async) apply leg resolves; Done closes.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

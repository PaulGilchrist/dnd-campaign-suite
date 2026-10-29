// @maintained-by-ai
// EffectAdder CLA-019 suppression-notice lane: an immunity-suppressed condition add
// keeps the modal OPEN with a visible inline notice naming the condition + immunity
// source (mirrors the CLA-011/232 "refusal must be visible" rest doctrine), while a
// successful add renders zero notice.
// NOT owned here (cited, not cloned):
//   #839 createEffectAdderHandlers.test.jsx — suppression dispatch: addCondition args
//        threaded, zero writes, target NOT cleared, refusal detail returned.
//   #856 EffectAdder.conditions.test.jsx — conditions tab face + exact dispatch payload.
//   services/combat/auras/auraConditionImmunity.test.js — immunity log copy (log truth).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';

describe('EffectAdder - immunity suppression notice', () => {
  let props;

  beforeEach(() => {
    props = {
      targetName: 'ElderPaladin',
      initialTab: 'conditions',
      onCancel: vi.fn(),
      onApply: vi.fn(),
    };
  });

  it('suppressed add keeps the modal open with an inline notice naming condition + immunity source', async () => {
    props.onApply.mockResolvedValue({
      suppressed: true,
      conditionLabel: 'Frightened',
      immunitySource: 'Aura of Courage from ElderPaladin',
    });
    const { container } = render(<EffectAdder {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Frightened' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('Frightened not applied — immune via Aura of Courage from ElderPaladin');
    expect(notice).toHaveClass('ea-immunity-notice');
    // Modal stays open: overlay + target heading still mounted, nothing cancelled.
    expect(container.querySelector('.ea-overlay')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ElderPaladin' })).toBeInTheDocument();
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('successful add (modal-closing outcome) renders zero notice', async () => {
    props.onApply.mockResolvedValue(undefined); // handler closes the modal itself on success
    const { container } = render(<EffectAdder {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Blinded' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    // Flush the awaited onApply, then prove the notice lane stayed silent.
    await waitFor(() => expect(props.onApply).toHaveBeenCalledTimes(1));
    await waitFor(() => undefined);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('.ea-immunity-notice')).toBeNull();
  });

  it('selecting another condition chip clears the stale notice', async () => {
    props.onApply.mockResolvedValue({
      suppressed: true,
      conditionLabel: 'Frightened',
      immunitySource: 'Aura of Courage from ElderPaladin',
    });
    const { container } = render(<EffectAdder {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Frightened' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Stunned' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('.ea-overlay')).toBeInTheDocument();
  });

  it('switching tabs clears the notice; returning to Conditions keeps it cleared', async () => {
    props.onApply.mockResolvedValue({
      suppressed: true,
      conditionLabel: 'Frightened',
      immunitySource: 'Aura of Courage from ElderPaladin',
    });
    render(<EffectAdder {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Frightened' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Conditions' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import ConcentrationPromptModal from './ConcentrationPromptModal.jsx'

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}))

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}))

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendConcentrationResult: vi.fn(),
}))

vi.mock('../../services/combat/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}))

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}))

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  hasSaveModifier: vi.fn(() => false),
}))

vi.mock('./Subscriber.jsx', () => ({
  default: function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      React.createElement(
        'button',
        {
          'data-testid': 'subscriber-trigger',
          onClick: () =>
            handleEvent({
              key: `change-${campaignName}-concentrationPrompt-testTarget`,
              data: {
                promptId: 'test-prompt-1',
                targetName: 'testTarget',
                spellName: 'Bless',
                dc: 10,
              },
            }),
        }
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'subscriber-trigger-second',
          onClick: () =>
            handleEvent({
              key: `change-${campaignName}-concentrationPrompt-testTarget2`,
              data: {
                promptId: 'test-prompt-2',
                targetName: 'testTarget2',
                spellName: 'Haste',
                dc: 13,
              },
            }),
        }
      )
    )
  },
}))

// jsdom does not provide EventSource, but the component checks for it
const MockEventSource = vi.fn()
MockEventSource.prototype.close = vi.fn()

function setupGlobalEventSource() {
  Object.defineProperty(globalThis, 'EventSource', {
    value: MockEventSource,
    writable: true,
    configurable: true,
  })
}

function createCharacter(name, saveModifiers) {
  return {
    name,
    computedStats: {
      abilities: [{ name: 'Constitution', bonus: 3 }],
    },
    saveModifiers: saveModifiers || [],
  }
}

describe('ConcentrationPromptModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupGlobalEventSource()
  })

  it('renders nothing when there are no prompts', () => {
    const { container } = render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )
    expect(container.querySelector('.cnp-overlay')).not.toBeInTheDocument()
  })

  it('renders the modal when a prompt is queued via Subscriber', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    expect(screen.getByText('testTarget')).toBeInTheDocument()
    expect(screen.getByText(/CONSTITUTION/i)).toBeInTheDocument()
    expect(screen.getByText('Bless')).toBeInTheDocument()
    expect(screen.getByText('DC 10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /roll con save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('dismisses the prompt when dismiss button is clicked', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss' })
    fireEvent.click(dismissBtn)

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument()
    })
  })

  it('shows result after rolling a save', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    const rollBtn = screen.getByRole('button', { name: /roll con save/i })
    fireEvent.click(rollBtn)

    await waitFor(() => {
      expect(screen.getByText(/total:/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/CONCENTRATION MAINTAINED/i)).toBeInTheDocument()
  })

  it('shows "Done" button after rolling with single prompt', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    const rollBtn = screen.getByRole('button', { name: /roll con save/i })
    fireEvent.click(rollBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    })
  })

  it('finds save bonus from character data', async () => {
    const character = createCharacter('testTarget')
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[character]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    const rollBtn = screen.getByRole('button', { name: /roll con save/i })
    fireEvent.click(rollBtn)

    await waitFor(() => {
      expect(screen.getByText(/total:/i)).toBeInTheDocument()
    })
  })

  it('dispatches concentration-result custom event after rolling', async () => {
    const eventHandler = vi.fn()
    window.addEventListener('concentration-result', eventHandler)

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    const rollBtn = screen.getByRole('button', { name: /roll con save/i })
    fireEvent.click(rollBtn)

    await waitFor(() => {
      expect(eventHandler).toHaveBeenCalled()
    })

    const eventDetail = eventHandler.mock.calls[0][0].detail
    expect(eventDetail.promptId).toBe('test-prompt-1')
    expect(eventDetail.targetName).toBe('testTarget')
    expect(eventDetail.spellName).toBe('Bless')
    expect(eventDetail.dc).toBe(10)

    window.removeEventListener('concentration-result', eventHandler)
  })

  it('does not show queue count for single prompt', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    expect(screen.queryByText(/\(1 of/)).not.toBeInTheDocument()
  })

  it('handles overlay click to dismiss', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    const overlay = document.querySelector('.cnp-overlay')
    if (overlay) {
      fireEvent.click(overlay)
    }

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument()
    })
  })

  it('does not dismiss when clicking inside the modal', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    const modal = document.querySelector('.cnp-modal')
    if (modal) {
      fireEvent.click(modal)
    }

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })
  })

  it('handles string characters in characters array', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={['testTarget']}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    const rollBtn = screen.getByRole('button', { name: /roll con save/i })
    fireEvent.click(rollBtn)

    await waitFor(() => {
      expect(screen.getByText(/total:/i)).toBeInTheDocument()
    })
  })

  it('does not show roll button when no prompts exist', () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    expect(screen.queryByRole('button', { name: /roll con save/i })).not.toBeInTheDocument()
  })

  it('renders Subscriber only when EventSource is available', () => {
    delete globalThis.EventSource

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    expect(screen.queryByTestId('subscriber')).not.toBeInTheDocument()

    setupGlobalEventSource()
  })

  it('shows save bonus breakdown in result', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    const rollBtn = screen.getByRole('button', { name: /roll con save/i })
    fireEvent.click(rollBtn)

    await waitFor(() => {
      expect(screen.getByText(/d20/i)).toBeInTheDocument()
    })
  })

  it('shows success message when save succeeds', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    const rollBtn = screen.getByRole('button', { name: /roll con save/i })
    fireEvent.click(rollBtn)

    await waitFor(() => {
      expect(screen.getByText(/CONCENTRATION MAINTAINED/i)).toBeInTheDocument()
    })
  })

  it('renders with correct campaign name on subscriber', () => {
    render(
      <ConcentrationPromptModal
        campaignName="my-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const subscriber = screen.getByTestId('subscriber')
    expect(subscriber).toHaveAttribute('data-campaign', 'my-campaign')
  })

  it('shows the spinner icon in header', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/Concentration Check/i)).toBeInTheDocument()
    })

    const spinner = document.querySelector('.cnp-header i.fa-solid.fa-spinner')
    expect(spinner).toBeInTheDocument()
  })

  it('shows concentration result breakdown with roll details', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    const rollBtn = screen.getByRole('button', { name: /roll con save/i })
    fireEvent.click(rollBtn)

    await waitFor(() => {
      expect(screen.getByText(/CONCENTRATION MAINTAINED/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/vs DC 10/)).toBeInTheDocument()
  })

  it('shows queue count when multiple prompts exist', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    const rollBtn = screen.getByRole('button', { name: /roll con save/i })
    fireEvent.click(rollBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    })

    const nextBtn = screen.getByRole('button', { name: 'Done' })
    fireEvent.click(nextBtn)

    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument()
  })

  it('shows queue info in header when multiple prompts are queued', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    )

    const trigger = screen.getByTestId('subscriber-trigger')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument()
    })

    const trigger2 = screen.getByTestId('subscriber-trigger-second')
    fireEvent.click(trigger2)

    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument()
    })
  })
})

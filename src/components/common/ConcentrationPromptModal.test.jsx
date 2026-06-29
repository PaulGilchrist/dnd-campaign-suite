// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { rollD20 } from '../../services/dice/diceRoller.js'
import { sendConcentrationResult } from '../../services/combat/conditions/savePromptService.js'
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js'
import { hasSaveModifier } from '../../services/combat/conditions/conditionEffects.js'
import ConcentrationPromptModal from './ConcentrationPromptModal.jsx'

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}))

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}))

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendConcentrationResult: vi.fn(),
  clearConcentrationPrompt: vi.fn(),
}))

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
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
        },
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
        },
      ),
    )
  },
}))

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
    // Default: rollD20 returns 10, which succeeds against DC 10
    vi.mocked(rollD20).mockReturnValue(10)
  })

  afterEach(() => {
    delete globalThis.EventSource
  })

  it('renders nothing when there are no prompts', () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )
    expect(screen.queryByText(/must make a/)).not.toBeInTheDocument()
  })

  it('renders the modal when a prompt is queued via Subscriber', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
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
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    await waitFor(() => {
      expect(screen.queryByText(/must make a/)).not.toBeInTheDocument()
    })
  })

  it('shows result after rolling a save', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/total:/i)).toBeInTheDocument()
    })
  })

  it('shows "Done" button after rolling with single prompt', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    })
  })

  it('shows "Next Check" button after rolling when multiple prompts exist', async () => {
    vi.mocked(rollD20).mockReturnValue(10)
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))
    fireEvent.click(screen.getByTestId('subscriber-trigger-second'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next Check' })).toBeInTheDocument()
    })
  })

  it('advances to the next prompt when "Next Check" is clicked', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))
    fireEvent.click(screen.getByTestId('subscriber-trigger-second'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    // Resolve the first prompt
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next Check' })).toBeInTheDocument()
    })

    // Advance to the next prompt
    fireEvent.click(screen.getByRole('button', { name: 'Next Check' }))

    await waitFor(() => {
      expect(screen.getByText(/testTarget2/)).toBeInTheDocument()
      expect(screen.getByText('Haste')).toBeInTheDocument()
    })

    // Now show Done since only one prompt remains
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

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
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

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
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

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
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    expect(screen.queryByText(/\(1 of/)).not.toBeInTheDocument()
  })

  it('handles overlay click to dismiss', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    const overlay = document.querySelector('.cnp-overlay')
    expect(overlay).toBeInTheDocument()
    fireEvent.click(overlay)

    await waitFor(() => {
      expect(screen.queryByText(/must make a/)).not.toBeInTheDocument()
    })
  })

  it('does not dismiss when clicking inside the modal', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    const modal = document.querySelector('.cnp-modal')
    expect(modal).toBeInTheDocument()
    fireEvent.click(modal)

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })
  })

  it('handles string characters in characters array', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={['testTarget']}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

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
      />,
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
      />,
    )

    expect(screen.queryByTestId('subscriber')).not.toBeInTheDocument()
  })

  it('shows save bonus breakdown in result', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

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
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/CONCENTRATION MAINTAINED/i)).toBeInTheDocument()
    })
  })

  it('shows failure message when save fails', async () => {
    vi.mocked(rollD20).mockReturnValue(1)

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/CONCENTRATION BROKEN/i)).toBeInTheDocument()
    })
  })

  it('renders with correct campaign name on subscriber', () => {
    render(
      <ConcentrationPromptModal
        campaignName="my-campaign"
        characters={[]}
        activeMapName={null}
      />,
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
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

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
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/CONCENTRATION MAINTAINED/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/vs DC 10/)).toBeInTheDocument()
  })

  it('shows queue info in header when multiple prompts are queued', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('subscriber-trigger-second'))

    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument()
    })
  })

  it('deduplicates prompts with the same promptId', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))
    // Send a duplicate prompt with the same promptId
    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    // Should still show queue count as 1 of 1, not 1 of 2
    expect(screen.queryByText(/\(1 of 2\)/)).not.toBeInTheDocument()
  })

  it('calls sendConcentrationResult with correct data after rolling', async () => {

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(sendConcentrationResult).toHaveBeenCalled()
    })

    const [calledCampaignName, calledTargetName, calledData] = sendConcentrationResult.mock.calls[0]
    expect(calledCampaignName).toBe('test-campaign')
    expect(calledTargetName).toBe('testTarget')
    expect(calledData.promptId).toBe('test-prompt-1')
    expect(calledData.spellName).toBe('Bless')
    expect(calledData.dc).toBe(10)
    expect(calledData.success).toBe(true)
    expect(calledData.roll).toBe(10)
    expect(calledData.total).toBe(10)
  })

  it('rolls with advantage when hasSaveModifier returns true for concentration_saving_throws', async () => {
    vi.mocked(hasSaveModifier).mockReturnValue(true)
    vi.mocked(rollD20).mockReturnValue(5)

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[createCharacter('testTarget')]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/total:/i)).toBeInTheDocument()
    })

    expect(rollD20).toHaveBeenCalledTimes(2)
  })

  it('rolls with advantage when saveModifiers has concentration_spell_damage condition', async () => {
    const character = createCharacter('testTarget', [
      {
        target: 'saving_throw',
        condition: 'concentration_spell_damage',
        effect: 'advantage',
        abilities: ['Constitution'],
      },
    ])

    vi.mocked(rollD20).mockReturnValue(3)

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[character]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/total:/i)).toBeInTheDocument()
    })

    expect(rollD20).toHaveBeenCalledTimes(2)
  })

  it('applies Starry Form buff when character has Dragon constellation and roll <= 9', async () => {
    const character = createCharacter('testTarget')
    character.activeBuffs = [
      { name: 'Starry Form', constellation: 'Dragon' },
    ]

    vi.mocked(rollD20).mockReturnValue(7)

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[character]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/total:/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/\+ 3/)).toBeInTheDocument()
  })

  it('does not apply Starry Form buff when roll > 9', async () => {
    const character = createCharacter('testTarget')
    character.activeBuffs = [
      { name: 'Starry Form', constellation: 'Dragon' },
    ]

    vi.mocked(rollD20).mockReturnValue(15)

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[character]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/total:/i)).toBeInTheDocument()
    })
  })

  it('shows aura bonus detail when aura provides a bonus', async () => {
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 2, sourceName: 'Bard' })

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/from Bard/)).toBeInTheDocument()
    })
  })

  it('shows aura bonus without source name when sourceName is null', async () => {
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 1, sourceName: null })

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/aura/)).toBeInTheDocument()
    })
  })

  it('does not show aura bonus detail when aura bonus is 0', async () => {
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 0, sourceName: null })

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/CONCENTRATION MAINTAINED/i)).toBeInTheDocument()
    })

    expect(screen.queryByText(/from/)).not.toBeInTheDocument()
  })

  it('shows queue position "2 of 2" when viewing second prompt', async () => {
    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))
    fireEvent.click(screen.getByTestId('subscriber-trigger-second'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next Check' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Next Check' }))

    await waitFor(() => {
      expect(screen.getByText(/testTarget2/)).toBeInTheDocument()
      expect(screen.queryByText(/\(.* of/)).not.toBeInTheDocument()
    })
  })

  it('handles error in character lookup gracefully', async () => {
    const character = createCharacter('testTarget')
    Object.defineProperty(character, 'name', {
      get() { throw new Error('Access denied') },
    })

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[character]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/total:/i)).toBeInTheDocument()
    })
  })

  it('uses saveModifiers from computedStats when top-level saveModifiers is undefined', async () => {
    const character = createCharacter('testTarget')
    delete character.saveModifiers
    character.computedStats.saveModifiers = [
      {
        target: 'concentration_saving_throws',
        effect: 'advantage',
      },
    ]

    vi.mocked(rollD20).mockReturnValue(5)

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[character]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/total:/i)).toBeInTheDocument()
    })

    expect(rollD20).toHaveBeenCalledTimes(2)
  })

  it('uses activeBuffs from computedStats when top-level activeBuffs is undefined', async () => {
    const character = createCharacter('testTarget')
    delete character.activeBuffs
    character.computedStats.activeBuffs = [
      { name: 'Starry Form', constellation: 'Dragon' },
    ]

    vi.mocked(rollD20).mockReturnValue(5)

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[character]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(screen.getByText(/total:/i)).toBeInTheDocument()
    })
  })

  it('sends saveBonus that includes both ability and aura bonuses', async () => {
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 2, sourceName: 'Bard' })

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[createCharacter('testTarget')]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(sendConcentrationResult).toHaveBeenCalled()
    })

    const [,, calledData] = sendConcentrationResult.mock.calls[0]
    expect(calledData.saveBonus).toBe(5)
  })

  it('shows result breakdown with aura bonus detail in event', async () => {
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 3, sourceName: 'Paladin' })

    const eventHandler = vi.fn()
    window.addEventListener('concentration-result', eventHandler)

    render(
      <ConcentrationPromptModal
        campaignName="test-campaign"
        characters={[createCharacter('testTarget')]}
        activeMapName={null}
      />,
    )

    fireEvent.click(screen.getByTestId('subscriber-trigger'))

    await waitFor(() => {
      expect(screen.getByText(/must make a/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }))

    await waitFor(() => {
      expect(eventHandler).toHaveBeenCalled()
    })

    const eventDetail = eventHandler.mock.calls[0][0].detail
    expect(eventDetail.saveBonus).toBe(6)
    expect(eventDetail.bonusDetail).toBe('(+3 aura from Paladin)')

    window.removeEventListener('concentration-result', eventHandler)
  })
})

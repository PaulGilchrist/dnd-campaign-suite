// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WarMagicSpellModal from './WarMagicSpellModal.jsx'
import { confirmWarMagicSpell } from '../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js'

vi.mock('../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js', () => ({
    confirmWarMagicSpell: vi.fn(),
}))

const mockAction = { name: 'Improved War Magic', automation: { type: 'war_magic_spell' } }
const mockPlayerStats = { name: 'TestFighter', rules: '2024' }
const mockCampaignName = 'test-campaign'
const mockOnClose = vi.fn()

// Real candidates: spells the handler would offer for Improved War Magic.
const mockOptions = ['Burning Hands', 'Magic Missile', 'Web']
// Modal only reads optionDetails[name]?.level and ?.casting_time — keep the mock to that.
const mockOptionDetails = {
    'Burning Hands': { level: 1, casting_time: '1 action' },
    'Magic Missile': { level: 1, casting_time: '1 action' },
    'Web': { level: 2, casting_time: '1 action' },
}

function makeProps(overrides) {
    return {
        action: mockAction,
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        options: mockOptions,
        optionDetails: mockOptionDetails,
        maxSpellLevel: 2,
        onClose: mockOnClose,
        ...(overrides || {}),
    }
}

const replaceButton = () => screen.getByRole('button', { name: /replace attack/i })

describe('WarMagicSpellModal', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('renders title, prompt, options with level and casting time, and keeps Replace Attack inert until a selection', () => {
        const { rerender } = render(<WarMagicSpellModal {...makeProps()} />)

        expect(screen.getByText('Improved War Magic')).toBeInTheDocument()
        expect(screen.getByText(/Replace one attack with a Wizard spell of level 1–2/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Burning Hands/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Magic Missile/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Web/ })).toBeInTheDocument()
        // Rows are real <button>s (semantic upgrade, fix pin pass #271): 3 spell rows + confirm + Cancel.
        expect(screen.getAllByRole('button')).toHaveLength(5)
        expect(screen.queryAllByText('Level 1')).toHaveLength(2)
        expect(screen.queryAllByText('Level 2')).toHaveLength(1)
        expect(screen.queryAllByText('(1 action)')).toHaveLength(3)
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

        const confirm = replaceButton()
        expect(confirm).toBeDisabled()
        fireEvent.click(confirm)
        expect(confirmWarMagicSpell).not.toHaveBeenCalled()

        // Prompt interpolates the maxSpellLevel prop — distinct copy, not hardcoded.
        rerender(<WarMagicSpellModal {...makeProps({ maxSpellLevel: 3 })} />)
        expect(screen.getByText(/Replace one attack with a Wizard spell of level 1–3/)).toBeInTheDocument()
        expect(screen.queryByText(/level 1–2/)).not.toBeInTheDocument()
    })

    it('omits level and casting time spans when details are missing or optionDetails is absent', () => {
        const { unmount } = render(<WarMagicSpellModal {...makeProps({
            optionDetails: {
                'Burning Hands': { level: 1 },
                'Magic Missile': { casting_time: '1 action' },
            },
        })} />)

        expect(screen.getByRole('button', { name: /Burning Hands/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Magic Missile/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Web/ })).toBeInTheDocument()
        expect(screen.queryAllByText('Level 1')).toHaveLength(1) // only Burning Hands has a level
        expect(screen.queryAllByText('Level 2')).toHaveLength(0)
        expect(screen.queryAllByText('(1 action)')).toHaveLength(1) // only Magic Missile has a casting time
        unmount()

        render(<WarMagicSpellModal {...makeProps({ optionDetails: null })} />)
        expect(screen.getByRole('button', { name: /Burning Hands/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Web/ })).toBeInTheDocument()
        expect(screen.queryAllByText(/Level \d/)).toHaveLength(0)
        expect(screen.queryAllByText('(1 action)')).toHaveLength(0)
    })

    it('submits the last-clicked spell with exact args, renders the HTML description unescaped, and Done closes once', async () => {
        confirmWarMagicSpell.mockResolvedValue({
            type: 'popup',
            payload: { description: '<b>Improved War Magic</b>: Cast <b>Web</b>.<br/>Weapon attack: Hit' },
        })

        const { container } = render(<WarMagicSpellModal {...makeProps()} />)
        fireEvent.click(screen.getByRole('button', { name: /Burning Hands/ }))
        fireEvent.click(screen.getByRole('button', { name: /Web/ }))
        expect(replaceButton()).toBeEnabled()
        fireEvent.click(replaceButton())

        await waitFor(() => {
            expect(confirmWarMagicSpell).toHaveBeenCalledTimes(1)
        })
        expect(confirmWarMagicSpell).toHaveBeenCalledWith(
            mockAction,
            mockPlayerStats,
            mockCampaignName,
            'Web'
        )

        // Handler descriptions arrive with markup — it must render as HTML, not escaped text.
        // .sp-body is the contract class the modal uses for dangerouslySetInnerHTML.
        expect(container.querySelector('.sp-body').innerHTML).toContain('<b>Web</b>')
        // Kept as a text query on purpose: this is the <b>Web</b> inside the result body,
        // not an option row — the choice view (and its row buttons) is already gone here.
        expect(screen.getByText('Web')).toBeInTheDocument()
        expect(screen.queryByText(/Replace one attack with a Wizard spell/)).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Done' }))
        expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('stays in the selection view when the handler returns no result', async () => {
        confirmWarMagicSpell.mockResolvedValue(null)

        render(<WarMagicSpellModal {...makeProps()} />)
        fireEvent.click(screen.getByRole('button', { name: /Web/ }))
        fireEvent.click(replaceButton())

        await waitFor(() => {
            expect(confirmWarMagicSpell).toHaveBeenCalledTimes(1)
        })
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()
        expect(screen.getByText(/Replace one attack with a Wizard spell/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Web/ })).toBeInTheDocument()
        expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('Cancel closes without dispatching the handler', () => {
        render(<WarMagicSpellModal {...makeProps()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(mockOnClose).toHaveBeenCalledTimes(1)
        expect(confirmWarMagicSpell).not.toHaveBeenCalled()
    })
})

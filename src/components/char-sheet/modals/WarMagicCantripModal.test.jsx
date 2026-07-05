// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WarMagicCantripModal from './WarMagicCantripModal.jsx'

vi.mock('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js', () => ({
    confirmWarMagicCantrip: vi.fn(),
}))

vi.mock('../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js', () => ({
    confirmWarMagicSpell: vi.fn(),
}))

const mockPlayerStats = { name: 'TestFighter', rules: '2024' }
const mockCampaignName = 'test-campaign'
const mockOnClose = vi.fn()

const mockAction = {
    name: 'Improved War Magic',
    automation: { type: 'war_magic_cantrip' },
}

const mockOptions = ['Ray of Frost', 'Shocking Grasp']

const mockOptionDetails = {
    'Ray of Frost': { name: 'Ray of Frost', level: 0, casting_time: '1 action', range: '120 ft', description: 'A bolt of freezing energy', damage: '1d8 cold' },
    'Shocking Grasp': { name: 'Shocking Grasp', level: 0, casting_time: '1 action', range: 'Self', description: 'A bolt of lightning', damage: '1d6 lightning' },
    'Burning Hands': { name: 'Burning Hands', level: 1, casting_time: '1 action', range: 'Self', description: 'Burst of flame', damage: '3d6 fire' },
}

function makeProps(overrides) {
    return {
        action: mockAction,
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        options: mockOptions,
        optionDetails: mockOptionDetails,
        onClose: mockOnClose,
        ...(overrides || {}),
    }
}

describe('WarMagicCantripModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    // ── Initial render ──

    it('renders the modal overlay and structure', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument()
        expect(document.querySelector('.sp-modal')).toBeInTheDocument()
        expect(document.querySelector('.sp-header')).toBeInTheDocument()
        expect(document.querySelector('.sp-body')).toBeInTheDocument()
        expect(document.querySelector('.sp-actions')).toBeInTheDocument()
    })

    it('renders the action name in the header', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(screen.getByText('Improved War Magic')).toBeInTheDocument()
    })

    it('renders all cantrip options', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(screen.getByText('Ray of Frost')).toBeInTheDocument()
        expect(screen.getByText('Shocking Grasp')).toBeInTheDocument()
    })

    it('renders the prompt text', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(screen.getByText(/Replace one attack with a Wizard cantrip/)).toBeInTheDocument()
    })

    it('renders the Cancel button', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('renders the Replace Attack button', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(screen.getByRole('button', { name: /replace attack/i })).toBeInTheDocument()
    })

    // ── Selection behavior ──

    it('disables confirm button when no selection', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        const confirmBtn = screen.getByRole('button', { name: /replace attack/i })
        expect(confirmBtn).toBeDisabled()
    })

    it('enables confirm button after selection', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        fireEvent.click(screen.getByText('Ray of Frost'))
        const confirmBtn = screen.getByRole('button', { name: /replace attack/i })
        expect(confirmBtn).toBeEnabled()
    })

    // ── Cancel behavior ──

    it('calls onClose when Cancel is clicked', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        fireEvent.click(screen.getByText('Cancel'))
        expect(mockOnClose).toHaveBeenCalled()
    })

    // ── Confirmation flow ──

    it('calls confirm handler with correct args when a cantrip is selected and confirmed', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the cantrip Ray of Frost.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(confirmWarMagicCantrip).toHaveBeenCalledWith(
                mockAction,
                mockPlayerStats,
                mockCampaignName,
                'Ray of Frost'
            )
        })
    })

    it('shows result state with Done button after confirmation', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the cantrip Ray of Frost.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument()
        })
    })

    it('renders result payload description as HTML via dangerouslySetInnerHTML', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the cantrip <b>Ray of Frost</b>.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            const bodyDiv = document.querySelector('.sp-body')
            expect(bodyDiv.innerHTML).toContain('<b>Ray of Frost</b>')
        })
    })

    // ── Close from result state ──

    it('calls onClose when Done is clicked after confirmation', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the cantrip Ray of Frost.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('Done'))
        expect(mockOnClose).toHaveBeenCalled()
    })

    it('calls onClose when clicking the overlay in result state', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Done.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument()
        })

        const overlay = document.querySelector('.sp-overlay')
        fireEvent.click(overlay)
        expect(mockOnClose).toHaveBeenCalled()
    })

    it('does NOT close when clicking inside modal in result state', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Done.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument()
        })

        const modal = document.querySelector('.sp-modal')
        fireEvent.click(modal)
        expect(mockOnClose).not.toHaveBeenCalled()
    })

    // ── Edge cases: empty options ──

    it('renders with no cantrip options when options array is empty', () => {
        render(<WarMagicCantripModal {...makeProps({ options: [] })} />)
        expect(screen.getByText('Improved War Magic')).toBeInTheDocument()
        expect(screen.getByText(/Replace one attack with a Wizard cantrip/)).toBeInTheDocument()
        expect(screen.queryAllByText(/Ray of Frost|Shocking Grasp/)).toHaveLength(0)
    })

    it('disables confirm button when there are no options', () => {
        render(<WarMagicCantripModal {...makeProps({ options: [] })} />)
        const confirmBtn = screen.getByRole('button', { name: /replace attack/i })
        expect(confirmBtn).toBeDisabled()
    })

    // ── Edge cases: missing optionDetails ──

    it('renders cantrip name without casting_time span when optionDetails is missing', () => {
        render(<WarMagicCantripModal {...makeProps({ optionDetails: {} })} />)
        expect(screen.getByText('Ray of Frost')).toBeInTheDocument()
        // No casting time should appear since optionDetails is empty
        expect(screen.queryAllByText(/\(1 action\)/)).toHaveLength(0)
    })

    // ── Edge cases: handler returns no result ──

    it('does not show result state when handler returns null', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue(null)

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(screen.queryByText('Done')).not.toBeInTheDocument()
        })
    })
})

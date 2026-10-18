// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WarMagicCantripModal from './WarMagicCantripModal.jsx'
import { confirmWarMagicCantrip } from '../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js'

vi.mock('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js', () => ({
    confirmWarMagicCantrip: vi.fn(),
}))

const mockAction = { name: 'Improved War Magic', automation: { type: 'war_magic_cantrip' } }
const mockPlayerStats = { name: 'TestFighter', rules: '2024' }
const mockCampaignName = 'test-campaign'
const mockOnClose = vi.fn()

const mockOptions = ['Ray of Frost', 'Shocking Grasp']
// Component only reads optionDetails[name]?.casting_time — keep the mock to that.
const mockOptionDetails = {
    'Ray of Frost': { casting_time: '1 action' },
    'Shocking Grasp': { casting_time: '1 action' },
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

const replaceButton = () => screen.getByRole('button', { name: /replace attack/i })

describe('WarMagicCantripModal', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('renders title, prompt, one option per cantrip, and keeps Replace Attack inert until a selection', () => {
        render(<WarMagicCantripModal {...makeProps()} />)

        expect(screen.getByText('Improved War Magic')).toBeInTheDocument()
        expect(screen.getByText(/Replace one attack with a Wizard cantrip/)).toBeInTheDocument()
        expect(screen.getByText('Ray of Frost')).toBeInTheDocument()
        expect(screen.getByText('Shocking Grasp')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

        const confirm = replaceButton()
        expect(confirm).toBeDisabled()
        fireEvent.click(confirm)
        expect(confirmWarMagicCantrip).not.toHaveBeenCalled()
    })

    it('shows casting time beside options that have details and omits it where details are missing', () => {
        render(<WarMagicCantripModal {...makeProps({ optionDetails: { 'Ray of Frost': { casting_time: '1 action' } } })} />)

        expect(screen.getByText('Ray of Frost')).toBeInTheDocument()
        expect(screen.getByText('Shocking Grasp')).toBeInTheDocument()
        expect(screen.queryAllByText('(1 action)')).toHaveLength(1)
    })

    it('submits the last-clicked cantrip with exact args, swaps to a result view, and Done closes once', async () => {
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: { description: 'Replaced one attack with the cantrip Shocking Grasp.' },
        })

        render(<WarMagicCantripModal {...makeProps()} />)
        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByText('Shocking Grasp'))
        expect(replaceButton()).toBeEnabled()
        fireEvent.click(replaceButton())

        await waitFor(() => {
            expect(confirmWarMagicCantrip).toHaveBeenCalledTimes(1)
        })
        expect(confirmWarMagicCantrip).toHaveBeenCalledWith(
            mockAction,
            mockPlayerStats,
            mockCampaignName,
            'Shocking Grasp'
        )

        expect(screen.getByText('Replaced one attack with the cantrip Shocking Grasp.')).toBeInTheDocument()
        expect(screen.queryByText(/Replace one attack with a Wizard cantrip/)).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Done' }))
        expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('stays in the selection view when the handler returns no result', async () => {
        confirmWarMagicCantrip.mockResolvedValue(null)

        render(<WarMagicCantripModal {...makeProps()} />)
        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(replaceButton())

        await waitFor(() => {
            expect(confirmWarMagicCantrip).toHaveBeenCalledTimes(1)
        })
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()
        expect(screen.getByText(/Replace one attack with a Wizard cantrip/)).toBeInTheDocument()
        expect(screen.getByText('Shocking Grasp')).toBeInTheDocument()
        expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('Cancel closes without dispatching the handler', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(mockOnClose).toHaveBeenCalledTimes(1)
        expect(confirmWarMagicCantrip).not.toHaveBeenCalled()
    })
})

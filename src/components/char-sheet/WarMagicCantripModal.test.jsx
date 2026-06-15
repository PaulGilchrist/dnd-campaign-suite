import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WarMagicCantripModal from './WarMagicCantripModal.jsx'

vi.mock('../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js', () => ({
    confirmWarMagicCantrip: vi.fn(),
}))

vi.mock('../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js', () => ({
    confirmWarMagicSpell: vi.fn(),
}))

describe('WarMagicCantripModal', () => {
    const mockOnClose = vi.fn()
    const mockAction = {
        name: 'Improved War Magic',
        automation: { type: 'war_magic_cantrip' },
    }
    const mockPlayerStats = { name: 'TestFighter', rules: '2024' }
    const mockCampaignName = 'test-campaign'
    const mockOptions = ['Ray of Frost', 'Shocking Grasp']
    const mockOptionDetails = {
        'Ray of Frost': { name: 'Ray of Frost', level: 0, casting_time: '1 action', range: '120 ft', description: 'A bolt of freezing energy', damage: '1d8 cold' },
        'Shocking Grasp': { name: 'Shocking Grasp', level: 0, casting_time: '1 action', range: 'Self', description: 'A bolt of lightning', damage: '1d6 lightning' },
        'Burning Hands': { name: 'Burning Hands', level: 1, casting_time: '1 action', range: 'Self', description: 'Burst of flame', damage: '3d6 fire' },
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders all cantrip options', () => {
        render(
            <WarMagicCantripModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                onClose={mockOnClose}
            />
        )

        expect(screen.getByText('Improved War Magic')).toBeInTheDocument()
        expect(screen.getByText('Ray of Frost')).toBeInTheDocument()
        expect(screen.getByText('Shocking Grasp')).toBeInTheDocument()
        expect(screen.getByText(/Replace one attack with a Wizard cantrip/)).toBeInTheDocument()
    })

    it('shows casting time for each cantrip', () => {
        render(
            <WarMagicCantripModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                onClose={mockOnClose}
            />
        )

        expect(screen.getAllByText(/\(1 action\)/)).toHaveLength(2)
    })

    it('disables confirm button when no selection', () => {
        render(
            <WarMagicCantripModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                onClose={mockOnClose}
            />
        )

        const confirmBtn = screen.getByRole('button', { name: /replace attack/i })
        expect(confirmBtn).toBeDisabled()
    })

    it('enables confirm button after selection', () => {
        render(
            <WarMagicCantripModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                onClose={mockOnClose}
            />
        )

        fireEvent.click(screen.getByText('Ray of Frost'))
        const confirmBtn = screen.getByRole('button', { name: /replace attack/i })
        expect(confirmBtn).toBeEnabled()
    })

    it('calls confirm handler and shows result on confirm', async () => {
        const { confirmWarMagicCantrip } = await import('../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the cantrip Ray of Frost.',
            },
        })

        render(
            <WarMagicCantripModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                onClose={mockOnClose}
            />
        )

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await waitFor(() => {
            expect(confirmWarMagicCantrip).toHaveBeenCalledWith(
                mockAction,
                mockPlayerStats,
                mockCampaignName,
                'Ray of Frost'
            )
        })

        await waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument()
        })
    })

    it('calls onClose when Done is clicked after confirmation', async () => {
        const { confirmWarMagicCantrip } = await import('../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the cantrip Ray of Frost.',
            },
        })

        render(
            <WarMagicCantripModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                onClose={mockOnClose}
            />
        )

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('Done'))
        expect(mockOnClose).toHaveBeenCalled()
    })

    it('calls onClose when Cancel is clicked', () => {
        render(
            <WarMagicCantripModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                onClose={mockOnClose}
            />
        )

        fireEvent.click(screen.getByText('Cancel'))
        expect(mockOnClose).toHaveBeenCalled()
    })

    it('highlights selected option', () => {
        render(
            <WarMagicCantripModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                onClose={mockOnClose}
            />
        )

        fireEvent.click(screen.getByText('Shocking Grasp'))
        const selectedEl = screen.getByText('Shocking Grasp').parentElement
        expect(selectedEl).toHaveStyle({ border: '2px solid #007bff' })
    })
})

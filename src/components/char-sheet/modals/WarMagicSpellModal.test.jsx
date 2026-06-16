import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WarMagicSpellModal from './WarMagicSpellModal.jsx'

vi.mock('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js', () => ({
    confirmWarMagicCantrip: vi.fn(),
}))

vi.mock('../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js', () => ({
    confirmWarMagicSpell: vi.fn(),
}))

describe('WarMagicSpellModal', () => {
    const mockOnClose = vi.fn()
    const mockAction = {
        name: 'Improved War Magic',
        automation: { type: 'war_magic_spell', maxSpellLevel: 2 },
    }
    const mockPlayerStats = { name: 'TestFighter', rules: '2024' }
    const mockCampaignName = 'test-campaign'
    const mockOptions = ['Burning Hands', 'Shield', 'Web']
    const mockOptionDetails = {
        'Burning Hands': { name: 'Burning Hands', level: 1, casting_time: '1 action', range: 'Self', description: 'Burst of flame', damage: '3d6 fire' },
        'Shield': { name: 'Shield', level: 1, casting_time: '1 reaction', range: 'Self', description: 'Arcane barrier', damage: null },
        'Web': { name: 'Web', level: 2, casting_time: '1 action', range: '60 ft', description: 'Creates areas of webbing', damage: '2d6 bludgeoning' },
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders all spell options with levels', () => {
        render(
            <WarMagicSpellModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                maxSpellLevel={2}
                onClose={mockOnClose}
            />
        )

        expect(screen.getByText('Improved War Magic')).toBeInTheDocument()
        expect(screen.getByText('Burning Hands')).toBeInTheDocument()
        expect(screen.getByText('Shield')).toBeInTheDocument()
        expect(screen.getByText('Web')).toBeInTheDocument()
        expect(screen.getAllByText(/Level 1/)).toHaveLength(2)
        expect(screen.getByText('Level 2')).toBeInTheDocument()
    })

    it('shows the correct prompt text', () => {
        render(
            <WarMagicSpellModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                maxSpellLevel={2}
                onClose={mockOnClose}
            />
        )

        expect(screen.getByText(/Replace one attack with a Wizard spell of level 1–2/)).toBeInTheDocument()
    })

    it('disables confirm button when no selection', () => {
        render(
            <WarMagicSpellModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                maxSpellLevel={2}
                onClose={mockOnClose}
            />
        )

        const confirmBtn = screen.getByRole('button', { name: /replace attack/i })
        expect(confirmBtn).toBeDisabled()
    })

    it('enables confirm button after selection', () => {
        render(
            <WarMagicSpellModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                maxSpellLevel={2}
                onClose={mockOnClose}
            />
        )

        fireEvent.click(screen.getByText('Web'))
        const confirmBtn = screen.getByRole('button', { name: /replace attack/i })
        expect(confirmBtn).toBeEnabled()
    })

    it('calls confirm handler and shows result on confirm', async () => {
        const { confirmWarMagicSpell } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js')
        confirmWarMagicSpell.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the level 2 spell Web.',
            },
        })

        render(
            <WarMagicSpellModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                maxSpellLevel={2}
                onClose={mockOnClose}
            />
        )

        fireEvent.click(screen.getByText('Web'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await waitFor(() => {
            expect(confirmWarMagicSpell).toHaveBeenCalledWith(
                mockAction,
                mockPlayerStats,
                mockCampaignName,
                'Web'
            )
        })

        await waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument()
        })
    })

    it('calls onClose when Done is clicked after confirmation', async () => {
        const { confirmWarMagicSpell } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js')
        confirmWarMagicSpell.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the level 2 spell Web.',
            },
        })

        render(
            <WarMagicSpellModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                maxSpellLevel={2}
                onClose={mockOnClose}
            />
        )

        fireEvent.click(screen.getByText('Web'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('Done'))
        expect(mockOnClose).toHaveBeenCalled()
    })

    it('calls onClose when Cancel is clicked', () => {
        render(
            <WarMagicSpellModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                maxSpellLevel={2}
                onClose={mockOnClose}
            />
        )

        fireEvent.click(screen.getByText('Cancel'))
        expect(mockOnClose).toHaveBeenCalled()
    })

    it('highlights selected option', () => {
        render(
            <WarMagicSpellModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                maxSpellLevel={2}
                onClose={mockOnClose}
            />
        )

        fireEvent.click(screen.getByText('Shield'))
        const selectedEl = screen.getByText('Shield').parentElement
        expect(selectedEl).toHaveStyle({ border: '2px solid #007bff' })
    })
})

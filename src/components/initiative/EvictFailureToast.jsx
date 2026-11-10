import React from 'react'

/**
 * Fail-loudly banner for REFUSED shared-key evictions
 * (bug-visitor-oa-resolution-strands-marker-double-resolve, owner ruling
 * 2026-11-10). deleteRuntimeKey (hooks/runtime/useRuntimeState.js) dispatches
 * `runtime-evict-failed` when the server 403s a drain-to-evict DELETE: the
 * local mirror is already gone but the shared marker survives server-side and
 * will replay on the next connect (the visitor-OA double-resolve strand was
 * silent). Mounted inside Initiative's `.initiative` root; the visible copy
 * reuses the existing .initiative-toast / .initiative-toast-error tokens from
 * Initiative.css (board-write feedback slot).
 */
const EvictFailureToast = ({ campaignName }) => {
    const [toast, setToast] = React.useState(null)

    React.useEffect(() => {
        const onEvictFailed = (e) => {
            const detail = e.detail || {}
            if (campaignName && detail.campaignName && detail.campaignName !== campaignName) return
            setToast(`Failed to clear shared marker "${detail.key}" — it will reappear`)
            setTimeout(() => setToast(null), 4000) // toast auto-hide (display only, no game state)
        }
        window.addEventListener('runtime-evict-failed', onEvictFailed)
        return () => window.removeEventListener('runtime-evict-failed', onEvictFailed)
    }, [campaignName])

    if (!toast) return null
    return (
        <div className='initiative-toast initiative-toast-error' role='status'>
            {toast}
        </div>
    )
}

export default EvictFailureToast

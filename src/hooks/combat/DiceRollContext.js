import React from 'react'

export const DiceRollContext = React.createContext({
    popupHtml: null,
    setPopupHtml: () => {},
})

export function useDiceRollPopup() {
    return React.useContext(DiceRollContext)
}

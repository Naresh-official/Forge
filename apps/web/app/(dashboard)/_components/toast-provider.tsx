"use client"

import { createContext, useContext, useMemo, useState } from "react"
import { Toast } from "./ui"

type ToastContextValue = {
    notify: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [message, setMessage] = useState<string | null>(null)

    const value = useMemo(
        () => ({
            notify(next: string) {
                setMessage(next)
                window.setTimeout(() => setMessage(null), 2400)
            },
        }),
        []
    )

    return (
        <ToastContext.Provider value={value}>
            {children}
            {message && (
                <Toast message={message} onClose={() => setMessage(null)} />
            )}
        </ToastContext.Provider>
    )
}

export function useToast() {
    const value = useContext(ToastContext)
    if (!value) throw new Error("useToast must be used inside ToastProvider")
    return value
}

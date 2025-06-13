"use client"

import type React from "react"
import { createContext, useContext } from "react"
import { useToast as useToastHook } from "../hooks/use-toast"

type ToastContextType = ReturnType<typeof useToastHook>

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toastMethods = useToastHook()

  console.log("ToastProvider rendered, current toasts:", toastMethods.toasts) // Debug log

  return <ToastContext.Provider value={toastMethods}>{children}</ToastContext.Provider>
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}



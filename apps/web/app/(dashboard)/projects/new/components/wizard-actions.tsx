/** Right-aligned footer row for the wizard buttons. */
export function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>
}

import { Table } from "@forge/ui/components/table"

/** Thin spacing wrapper around the UI table. Renders on the server as well. */
export function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <Table>{children}</Table>
    </div>
  )
}

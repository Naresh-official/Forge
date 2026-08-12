import { Sparkles } from "lucide-react"

function ForgeLogo() {
    return (
        <div className="mb-12 flex items-center justify-center gap-2 text-4xl font-bold">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-5" />
            </span>
            <span>Forge</span>
        </div>
    )
}

export default ForgeLogo

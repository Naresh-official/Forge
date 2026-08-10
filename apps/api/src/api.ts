import express from "express"
import type { Express } from "express"

const app: Express = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get("/api/v1/health", (req, res) => {
    res.status(200).json({ status: "ok" })
})

export default app

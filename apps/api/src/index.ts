import app from "./app"
import apiConfig from "@workspace/config/api"
import prisma from "./utils/db"

const PORT = apiConfig.port

async function startServer() {
    try {
        await prisma.$connect()

        // Ping the database
        await prisma.$queryRaw`SELECT 1`

        console.log("Database connected")

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)
        })
    } catch (error: any) {
        console.error("Database connection failed:", error.message)
        process.exit(1)
    }
}

startServer()

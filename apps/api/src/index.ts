import app from "./app"
import apiConfig from "@workspace/config/api"
import prisma from "./utils/db"
import logger from "./utils/logger"

const PORT = apiConfig.port

async function startServer() {
    try {
        await prisma.$connect()

        await prisma.$queryRaw`SELECT 1`

        logger.info("Database connected")

        app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`)
        })
    } catch (error) {
        logger.error(error, "Database connection failed")
        process.exit(1)
    }
}

startServer()

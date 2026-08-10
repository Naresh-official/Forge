import app from "./api"
import apiConfig from "@workspace/config/api"
import prisma from "./lib/db"
const PORT = apiConfig.port

prisma
    .$connect()
    .then(() => {
        console.log("Database connected")
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)
        })
    })
    .catch((error) => {
        console.error("Database connection failed:", error)
    })

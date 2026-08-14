import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"
import apiConfig from "@forge/config/api"

const adapter = new PrismaPg({
    connectionString: apiConfig.databaseUrl,
})

const prisma = new PrismaClient({ adapter })

export default prisma

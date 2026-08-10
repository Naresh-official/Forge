import { z } from "zod"
import { loadEnv, loadYamlConfig } from "./shared"

// 1. Load the global env and static YAML configs
loadEnv()
const yamlConfig = loadYamlConfig()

// 2. Define the Zod validation schema for the Deployer service
export const deployerSchema = z.object({
    port: z.number().int().positive().default(3003),
    clusterName: z.string().default("forge-cluster"),
    region: z.string().default("us-east-1"),
})

// 3. Merge static yaml configs and env variables
const merged = {
    ...yamlConfig.deployer,
    region: process.env.AWS_REGION || undefined,
}

// 4. Validate and export
export const deployerConfig = deployerSchema.parse(merged)
export type DeployerConfig = z.infer<typeof deployerSchema>
export default deployerConfig

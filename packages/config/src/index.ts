export { default as webConfig, webSchema } from "./web"
export type { WebConfig } from "./web"

export { default as apiConfig, apiSchema } from "./api"
export type { ApiConfig } from "./api"

export { default as builderConfig, builderSchema } from "./builder"
export type { BuilderConfig } from "./builder"

export { default as deployerConfig, deployerSchema } from "./deployer"
export type { DeployerConfig } from "./deployer"

// Short aliases
export { default as web } from "./web"
export { default as api } from "./api"
export { default as builder } from "./builder"
export { default as deployer } from "./deployer"

// Combined default export
import webVal from "./web"
import apiVal from "./api"
import builderVal from "./builder"
import deployerVal from "./deployer"

const config = {
    web: webVal,
    api: apiVal,
    builder: builderVal,
    deployer: deployerVal,
}

export default config

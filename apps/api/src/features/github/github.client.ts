import { App } from "octokit"
import fs from "node:fs"
import { apiConfig } from "@workspace/config/api"

const privateKey = fs.readFileSync(apiConfig.github.privateKeyPath, "utf8")

export const githubApp: App = new App({
    appId: apiConfig.github.appId,
    privateKey,
})

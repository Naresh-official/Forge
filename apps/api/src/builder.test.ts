import { startBuildWrapper } from "./gRPC/wrapper/builder.wrapper"

const result = await startBuildWrapper({
  buildId: "536675be-3025-4aad-8e7a-9e296eb1ae74",
})

console.log(result)

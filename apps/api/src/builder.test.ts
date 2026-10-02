import { startBuildWrapper } from "./gRPC/wrapper/builder.wrapper"

const result = await startBuildWrapper({
  buildId: "66bd0690-6abd-49d7-a83a-6fa1c9b21b80",
})

console.log(result)

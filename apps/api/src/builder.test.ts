import { startBuildWrapper } from "./gRPC/wrapper/builder.wrapper"

const result = await startBuildWrapper({
  buildId: "ce446edc-4575-4847-bfb9-8cc978ae15cc",
})

console.log(result)

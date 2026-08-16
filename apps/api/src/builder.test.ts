import { startBuildWrapper } from "./gRPC/wrapper/builder.wrapper"

const result = await startBuildWrapper({
    buildId: "1115b7f8-f2ee-4928-82db-9a7cd5c73768",
})

console.log(result)

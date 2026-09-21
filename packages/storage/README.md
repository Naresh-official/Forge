# @forge/storage

S3-compatible object storage helpers for uploading build artifacts, backed by
the MinIO client SDK. Works with MinIO locally and any S3-compatible provider.

```ts
import { uploadDirectory } from "@forge/storage"

await uploadDirectory({
  config: {
    endpoint: "http://localhost:9000",
    accessKey: "minioadmin",
    secretKey: "minioadmin",
    bucket: "forge-artifacts",
  },
  directoryPath: "/tmp/repo/dist",
  objectPrefix: "deployments/123",
})
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

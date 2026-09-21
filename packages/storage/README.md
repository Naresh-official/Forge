# @forge/storage

AWS S3 object storage helpers for uploading build artifacts, backed by the
official `@aws-sdk/client-s3` SDK.

```ts
import { uploadDirectory } from "@forge/storage"

await uploadDirectory({
  config: {
    region: "us-east-1",
    accessKeyId: "AKIA...",
    secretAccessKey: "...",
    bucket: "forge-artifacts",
  },
  directoryPath: "/tmp/repo/dist",
  objectPrefix: "<projectId>/<deploymentId>/<repo-name>",
})
```

The bucket is created automatically if it does not exist.

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

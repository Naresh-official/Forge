# @forge/registry

Helpers for pushing built Docker images to **Amazon ECR** by driving the
`docker` CLI (tag → login → push). Registry login uses a short-lived ECR
authorization token fetched via the `@aws-sdk/client-ecr` SDK, so no
`aws-cli` and no static registry password are required.

```ts
import { pushImage } from "@forge/registry"

await pushImage({
  config: {
    registryId: "123456789012", // AWS account id
    region: "us-east-1",
    accessKeyId: "AKIA...",
    secretAccessKey: "...",
  },
  imageName: "forge-abc123",
  repository: "forge-project",
  tag: "projId.depId.hello-world",
})
```

All images are pushed into a single ECR repository ("forge-project").
Since Docker tags cannot contain `/`, the storage structure
`<projectId>/<deploymentId>/<repo-name>` is flattened into the tag as
`<projectId>.<deploymentId>.<repoName>` (dev builds get a `-dev` suffix) —
see `buildImageTag()`. Docker-compose services become
`<tag>.<serviceName>`.

Also exposes:

- `pushComposeImages()` — tag & push every service in a docker-compose file.
- `getEcrAuthorizationToken()` — decode an ECR token into docker login
  credentials; used by the deployer to build Kubernetes `imagePullSecrets`.

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

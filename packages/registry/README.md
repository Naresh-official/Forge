# @forge/registry

Helpers for pushing built Docker images to a registry by driving the
`docker` CLI (tag → login → push).

```ts
import { pushImage } from "@forge/registry"

await pushImage({
  config: {
    url: "localhost:5000",
  },
  imageName: "forge-abc123",
  repository: "octocat/hello-world",
  tag: "main",
})
```

Also exposes `pushComposeImages()` for `docker compose push`.

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

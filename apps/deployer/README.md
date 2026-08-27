# Deployer Service

Worker service that takes deployment jobs from the API via gRPC, adds them to a BullMQ queue, and deploys artifacts/images.

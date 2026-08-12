import type { CreateUserInput } from "@workspace/types/auth"
import { api } from "./client"
import type { ApiResponse } from "@workspace/types/apiResponses"
import type { UserResponse } from "@workspace/types/user"

export function handleGithubAuth(input: CreateUserInput) {
    return api<ApiResponse<UserResponse>>("/auth/github", {
        headers: {
            "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify(input),
    })
}

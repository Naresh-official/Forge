import type { CreateUserInput } from "@forge/types/auth"
import { api } from "./client"
import type { ApiResponse } from "@forge/types/apiResponses"
import type { UserResponse } from "@forge/types/user"

export function handleGithubAuth(input: CreateUserInput) {
    return api<ApiResponse<UserResponse>>("/auth/github", {
        headers: {
            "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify(input),
    })
}

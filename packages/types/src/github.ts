export type GithubSetUpBody = {
    installation: {
        id: string
        account: {
            login: string
            type: string
        }
    }
    repositories: [
        {
            id: string
            full_name: string
        },
    ]
}

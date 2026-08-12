class ApiResponse<T> {
    statusCode: number
    data: T
    message: string
    success: boolean

    constructor(statusCode: number, data: T, message: string = "Success") {
        this.statusCode = statusCode
        this.data = data
        this.message = message
        this.success = statusCode < 400
    }
}

export { ApiResponse }

class ApiError extends Error {
    statusCode: number
    data: null
    success: boolean

    constructor(
        statusCode: number,
        message: string = "Something went wrong",
        stack: string = ""
    ) {
        super(message)
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false

        if (stack) {
            this.stack = stack
        } else {
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

export { ApiError }

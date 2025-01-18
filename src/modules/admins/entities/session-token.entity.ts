export class SessionToken {
    /**
     * The admin's session token.
     * Send this in the `Authorization` request header as a bearer token (`Bearer your_token`) for private endpoints.
     *
     * @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     */
    public declare token: string;
}

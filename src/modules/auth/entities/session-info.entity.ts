import { Database } from "@database";
import AdminRole = Database.AdminRole;

export class SessionInfo {
    /**
     * The username of the currently logged-in admin.
     *
     * @example "some_admin.123"
     */
    public declare username: string;
    /**
     * The role of the currently logged-in admin.
     *
     * @example "admin"
     */
    public declare role: AdminRole;
}

import { Database } from "@database";
import { Reflector } from "@nestjs/core";
import AdminRole = Database.AdminRole;

export const Role = Reflector.createDecorator<AdminRole>();

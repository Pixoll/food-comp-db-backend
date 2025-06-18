import { config as dotenv } from "dotenv";

dotenv();

if (!process.env.AUTH_COOKIE_NAME) {
    throw new Error("AUTH_COOKIE_NAME is required");
}

if (!process.env.AUTH_COOKIE_MAX_AGE_MINUTES) {
    throw new Error("AUTH_COOKIE_MAX_AGE_MINUTES is required");
}

if (!process.env.TOKEN_SECRET) {
    throw new Error("TOKEN_SECRET is required");
}

if (Number.isNaN(+process.env.AUTH_COOKIE_MAX_AGE_MINUTES) || +process.env.AUTH_COOKIE_MAX_AGE_MINUTES <= 0) {
    throw new Error("AUTH_COOKIE_MAX_AGE_MINUTES must be a positive number");
}

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME;
const AUTH_COOKIE_MAX_AGE = +process.env.AUTH_COOKIE_MAX_AGE_MINUTES * 60_000;
const TOKEN_SECRET = process.env.TOKEN_SECRET;

export {
    AUTH_COOKIE_NAME,
    AUTH_COOKIE_MAX_AGE,
    TOKEN_SECRET,
};

import { config as dotenvConfig } from "dotenv";
import express from "express";

dotenvConfig();

const app = express();
const router = express.Router();
const PORT = +(process.env.PORT ?? 0) || 3000;

void async function (): Promise<void> {
    app.listen(PORT, () => {
        console.log("API listening on port:", PORT);
    });

    app.use("/api/v1", router);
}();

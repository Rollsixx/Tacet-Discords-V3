import { migrate, database } from "../src/lib/server/database.ts";
await migrate();
console.log("Database migrations applied.");
database().close();

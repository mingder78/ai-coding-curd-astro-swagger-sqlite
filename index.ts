import { Elysia } from "elysia";

const app = new Elysia().get("/", () => "Hello ming, Vercel with Bun!").listen(3000);

export default app.handle;

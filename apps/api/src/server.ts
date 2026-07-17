import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = Number(process.env.BACKEND_PORT ?? 3001);
const hostname = process.env.BACKEND_HOST ?? "0.0.0.0";

serve({ fetch: app.fetch, port, hostname }, ({ address, port }) => {
	console.log(
		`Content Island Hono backend listening on http://${address}:${port}`,
	);
});

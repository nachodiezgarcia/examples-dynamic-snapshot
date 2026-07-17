import { isApiClientError } from "@content-island/api-client";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { contentIslandClient } from "./content-island.js";

export const app = new Hono();

app.use("/api/*", cors());

const fail = (err: unknown) => {
	if (isApiClientError(err)) {
		return Response.json(
			{ error: err.code, message: err.message },
			{ status: err.status },
		);
	}
	console.error(err);
	return Response.json(
		{ error: "INTERNAL_ERROR", message: "Unexpected error" },
		{ status: 500 },
	);
};

app.get("/health", (c) => c.json({ ok: true }));

app.get("/api/snapshot-info", async (c) => {
	try {
		return c.json(await contentIslandClient.getSnapshotInfo());
	} catch (err) {
		return fail(err);
	}
});

app.get('/api/contents', async (c) => {
  try {
    const contents = await contentIslandClient.getRawContentList({
      contentType: c.req.query('contentType'),
      language: c.req.query('language'),
    });

    return c.json(contents);
  } catch (err) {
    return fail(err);
  }
});

app.on(["GET", "POST"], "/api/refresh", async (c) => {
	const secret = process.env.REFRESH_SECRET;
	const provided = c.req.header("x-refresh-secret") ?? c.req.query("secret");
	if (!secret || provided !== secret) {
		return c.json({ error: "UNAUTHORIZED" }, 401);
	}
	try {
		return c.json(await contentIslandClient.refreshSnapshot());
	} catch (err) {
		return fail(err);
	}
});

export default app;

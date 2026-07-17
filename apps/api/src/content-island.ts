import {
	type ContentSnapshot,
	createClient,
	exportSnapshot,
} from "@content-island/api-client";
import snapshot from "../content-island-snapshot.json" with { type: "json" };

const readToken = process.env.CONTENT_ISLAND_READ_TOKEN;

// Con token, el loader pide el contenido en vivo (permite refrescar); sin token, sirve el snapshot incrustado en el bundle.
export const contentIslandClient = createClient({
	accessToken: readToken ?? "snapshot-mode",
	mode: "snapshot",
	snapshotLoader: readToken
		? () => exportSnapshot({ accessToken: readToken })
		: async () => snapshot as ContentSnapshot,
});

import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

type SnapshotInfo = {
	schemaVersion: number;
	exportedAt: string;
	projectId: string;
	view: string;
};

type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

type Content = {
	id: string;
	name: string;
	fields: Array<{ name: string; value: JsonValue; language: string }>;
};

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
	if (!res.ok) {
		throw new Error(`Backend responded ${res.status} for ${url}`);
	}
	return res.json() as Promise<T>;
}

const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
	const backendUrl = process.env.API_URL ?? "http://localhost:3001";
	const [info, contents] = await Promise.all([
		fetchJson<SnapshotInfo>(`${backendUrl}/api/snapshot-info`),
		fetchJson<Content[]>(`${backendUrl}/api/contents`),
	]);
	return { info, contents };
});

export const Route = createFileRoute("/")({
	loader: () => getHomeData(),
	component: Home,
});

function Home() {
	const { info, contents } = Route.useLoaderData();
	return (
		<main style={{ fontFamily: "system-ui", padding: 32, lineHeight: 1.6 }}>
			<h1>Content Island · Static Snapshot + Hono</h1>
			<p>
				Snapshot exportado: <strong>{info.exportedAt}</strong> · vista{" "}
				<strong>{info.view}</strong>
			</p>
			<p>
				Contenidos servidos por el backend Hono:{" "}
				<strong>{contents.length}</strong>
			</p>
			<ul>
				{contents.map((content) => (
					<li key={content.id}>
						<strong>{content.name}</strong>
						<ul>
							{content.fields.map((field) => (
								<li key={`${content.id}-${field.name}-${field.language}`}>
									{field.name}: {String(field.value)} ({field.language})
								</li>
							))}
						</ul>
					</li>
				))}
			</ul>
			<p style={{ color: "#666" }}>
				Datos leídos de <code>content-island-snapshot.json</code> sin ninguna
				petición HTTP a Content Island.
			</p>
		</main>
	);
}

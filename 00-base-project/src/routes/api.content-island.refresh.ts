import { createFileRoute } from '@tanstack/react-router';
import { contentIslandClient } from '../server/content-island';
export const Route = createFileRoute('/api/content-island/refresh')({
    server: {
        handlers: {
            POST: async ({ request }) => {
                if (request.headers.get('x-refresh-secret') !==
                    process.env.REFRESH_SECRET) {

                    return new Response('Unauthorized', { status: 401 });
                }
                const result = await contentIslandClient.refreshSnapshot();
                return Response.json(result); // { status: 'updated' | 'unchanged', ∫meta: {...} }
            },
        },
    },
});
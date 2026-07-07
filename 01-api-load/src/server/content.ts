import { createServerFn } from '@tanstack/react-start';
import { contentIslandClient, ensureSnapshot } from './content-island';

export const getHomeData = createServerFn({ method: 'GET' }).handler(async () => {
    await ensureSnapshot();
    const info = await contentIslandClient.getSnapshotInfo();

    // Ajusta el contentType al de tu proyecto (o quita el filtro para traer todo).
    const posts = await contentIslandClient.getContentList({
        contentType: 'post'
    });

    return { exportedAt: info.exportedAt, count: posts.length };
});
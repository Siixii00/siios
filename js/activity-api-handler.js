import { handleActivitySync, handleActivitySources, handleActivitySettings } from './api/activity-sync.js';

window.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    if (url.pathname.startsWith('/api/activities')) {
        event.respondWith(handleActivityAPI(event.request));
    }
});

async function handleActivityAPI(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/activities/sync') {
        return handleActivitySync(request);
    }
    
    if (url.pathname === '/api/activities/sources') {
        return handleActivitySources(request);
    }
    
    if (url.pathname === '/api/activities/settings') {
        return handleActivitySettings(request);
    }
    
    return Response.json({
        success: false,
        error: 'Not found'
    }, { status: 404 });
}
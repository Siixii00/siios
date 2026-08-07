import { ActivityDB, ActivitySourcesDB, ActivitySettingsDB, SettingsDB } from './db.js';
import { handleActivitySync, handleActivitySources, handleActivitySettings } from '../api/activity-sync.js';

const router = {
    async handleRequest(path, request) {
        if (path.startsWith('/api/activities')) {
            return this.handleActivityAPI(path, request);
        }
        return null;
    },

    async handleActivityAPI(path, request) {
        if (path === '/api/activities/sync') {
            return handleActivitySync(request);
        }
        
        if (path === '/api/activities/sources') {
            return handleActivitySources(request);
        }
        
        if (path === '/api/activities/settings') {
            return handleActivitySettings(request);
        }

        if (path === '/api/activities/stats') {
            return this.handleActivityStats(request);
        }

        return null;
    },

    async handleActivityStats(request) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            const url = new URL(request.url);
            const hours = parseInt(url.searchParams.get('hours') || '24');
            
            const summary = await ActivityDB.getSummary(hours);
            const sources = await ActivitySourcesDB.getAll();
            const settings = await ActivitySettingsDB.get();

            return Response.json({
                success: true,
                stats: {
                    summary,
                    sources_count: sources.length,
                    enabled: settings?.global_enabled || false,
                    privacy_level: settings?.global_level || 'basic',
                    retention_days: settings?.retention_days || 30
                }
            }, { headers: corsHeaders });
        } catch (error) {
            return Response.json({
                success: false,
                error: error.message
            }, { status: 500, headers: corsHeaders });
        }
    }
};

export { router as activityAPIRouter };
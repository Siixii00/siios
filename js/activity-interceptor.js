import { ActivityDB, ActivitySourcesDB, ActivitySettingsDB } from './db.js';

const API_PREFIX = '/api/activities';

export function initActivityAPI() {
    const originalFetch = window.fetch;
    
    window.fetch = async function(input, init) {
        let request;
        
        if (typeof input === 'string') {
            request = new Request(input, init);
        } else {
            request = input;
        }

        const url = new URL(request.url);
        
        if (url.pathname.startsWith(API_PREFIX)) {
            const response = await handleLocalAPI(request);
            if (response) {
                return response;
            }
        }

        return originalFetch.call(window, request);
    };
}

async function handleLocalAPI(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === `${API_PREFIX}/sync`) {
        return handleActivitySync(request);
    }
    
    if (path === `${API_PREFIX}/sources`) {
        return handleActivitySources(request);
    }
    
    if (path === `${API_PREFIX}/settings`) {
        return handleActivitySettings(request);
    }

    if (path === `${API_PREFIX}/stats`) {
        return handleActivityStats(request);
    }

    return null;
}

async function handleActivitySync(request) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'POST') {
        try {
            const body = await request.json();
            const { activities, source, device } = body;

            if (!activities || !Array.isArray(activities)) {
                return createJSONResponse({
                    success: false,
                    error: 'Invalid activities data'
                }, 400, corsHeaders);
            }

            const settings = await ActivitySettingsDB.get();
            
            if (!settings?.global_enabled) {
                return createJSONResponse({
                    success: false,
                    error: 'Activity sync is disabled'
                }, 403, corsHeaders);
            }

            let sourceRecord = null;
            if (source === 'extension' && device) {
                const existingSources = await ActivitySourcesDB.getAll();
                sourceRecord = existingSources.find(s => 
                    s.device_type === device.type && 
                    s.platform === device.platform
                );

                if (!sourceRecord) {
                    const sourceId = `ext_${device.platform || 'unknown'}_${Date.now()}`;
                    sourceRecord = await ActivitySourcesDB.register({
                        id: sourceId,
                        device_type: device.type,
                        platform: device.platform,
                        device_name: device.userAgent?.substring(0, 50) || 'Unknown Browser',
                        enabled: true
                    });
                } else {
                    await ActivitySourcesDB.update(sourceRecord.id, {
                        last_sync: Date.now()
                    });
                }
            }

            let savedCount = 0;
            for (const activity of activities) {
                try {
                    await ActivityDB.create({
                        ...activity,
                        user_id: settings.user_id || null,
                        source: source || 'extension',
                        metadata: {
                            ...activity.metadata,
                            source_id: sourceRecord?.id || null,
                            device_info: device || null
                        }
                    });
                    savedCount++;
                } catch (error) {
                    console.error('[Activity Sync] Failed to save activity:', error);
                }
            }

            return createJSONResponse({
                success: true,
                synced: savedCount,
                message: `Successfully synced ${savedCount} activities`
            }, 200, corsHeaders);

        } catch (error) {
            console.error('[Activity Sync] Error:', error);
            return createJSONResponse({
                success: false,
                error: error.message
            }, 500, corsHeaders);
        }
    }

    if (request.method === 'GET') {
        try {
            const url = new URL(request.url);
            const limit = parseInt(url.searchParams.get('limit') || '100');
            const platform = url.searchParams.get('platform');
            const hours = parseInt(url.searchParams.get('hours') || '24');

            let activities;
            if (platform) {
                activities = await ActivityDB.getByPlatform(platform, limit);
            } else {
                activities = await ActivityDB.getAll(limit);
            }

            const summary = await ActivityDB.getSummary(hours);

            return createJSONResponse({
                success: true,
                activities,
                summary
            }, 200, corsHeaders);

        } catch (error) {
            return createJSONResponse({
                success: false,
                error: error.message
            }, 500, corsHeaders);
        }
    }

    return createJSONResponse({
        success: false,
        error: 'Method not allowed'
    }, 405, corsHeaders);
}

async function handleActivitySources(request) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'GET') {
        try {
            const sources = await ActivitySourcesDB.getAll();
            return createJSONResponse({
                success: true,
                sources
            }, 200, corsHeaders);
        } catch (error) {
            return createJSONResponse({
                success: false,
                error: error.message
            }, 500, corsHeaders);
        }
    }

    if (request.method === 'POST') {
        try {
            const body = await request.json();
            const source = await ActivitySourcesDB.register(body);
            return createJSONResponse({
                success: true,
                source
            }, 200, corsHeaders);
        } catch (error) {
            return createJSONResponse({
                success: false,
                error: error.message
            }, 500, corsHeaders);
        }
    }

    if (request.method === 'DELETE') {
        try {
            const url = new URL(request.url);
            const sourceId = url.searchParams.get('id');
            
            if (!sourceId) {
                return createJSONResponse({
                    success: false,
                    error: 'Source ID required'
                }, 400, corsHeaders);
            }

            await ActivitySourcesDB.delete(sourceId);
            return createJSONResponse({
                success: true,
                message: 'Source deleted'
            }, 200, corsHeaders);
        } catch (error) {
            return createJSONResponse({
                success: false,
                error: error.message
            }, 500, corsHeaders);
        }
    }

    return createJSONResponse({
        success: false,
        error: 'Method not allowed'
    }, 405, corsHeaders);
}

async function handleActivitySettings(request) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'GET') {
        try {
            const settings = await ActivitySettingsDB.get();
            return createJSONResponse({
                success: true,
                settings
            }, 200, corsHeaders);
        } catch (error) {
            return createJSONResponse({
                success: false,
                error: error.message
            }, 500, corsHeaders);
        }
    }

    if (request.method === 'POST') {
        try {
            const body = await request.json();
            const settings = await ActivitySettingsDB.set(body);
            return createJSONResponse({
                success: true,
                settings
            }, 200, corsHeaders);
        } catch (error) {
            return createJSONResponse({
                success: false,
                error: error.message
            }, 500, corsHeaders);
        }
    }

    return createJSONResponse({
        success: false,
        error: 'Method not allowed'
    }, 405, corsHeaders);
}

async function handleActivityStats(request) {
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

        return createJSONResponse({
            success: true,
            stats: {
                summary,
                sources_count: sources.length,
                enabled: settings?.global_enabled || false,
                privacy_level: settings?.global_level || 'basic',
                retention_days: settings?.retention_days || 30
            }
        }, 200, corsHeaders);
    } catch (error) {
        return createJSONResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

function createJSONResponse(data, status, headers) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    });
}
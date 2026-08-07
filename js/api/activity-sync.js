import { ActivityDB, ActivitySourcesDB, ActivitySettingsDB } from '../db.js';

export async function handleActivitySync(request) {
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
                return Response.json({
                    success: false,
                    error: 'Invalid activities data'
                }, { status: 400, headers: corsHeaders });
            }

            const settings = await ActivitySettingsDB.get();
            
            if (!settings?.global_enabled) {
                return Response.json({
                    success: false,
                    error: 'Activity sync is disabled'
                }, { status: 403, headers: corsHeaders });
            }

            let sourceRecord = null;
            if (source === 'extension' && device) {
                const sourceId = `ext_${device.platform || 'unknown'}_${Date.now()}`;
                
                const existingSources = await ActivitySourcesDB.getAll();
                sourceRecord = existingSources.find(s => 
                    s.device_type === device.type && 
                    s.platform === device.platform
                );

                if (!sourceRecord) {
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

            return Response.json({
                success: true,
                synced: savedCount,
                message: `Successfully synced ${savedCount} activities`
            }, { headers: corsHeaders });

        } catch (error) {
            console.error('[Activity Sync] Error:', error);
            return Response.json({
                success: false,
                error: error.message
            }, { status: 500, headers: corsHeaders });
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

            return Response.json({
                success: true,
                activities,
                summary
            }, { headers: corsHeaders });

        } catch (error) {
            return Response.json({
                success: false,
                error: error.message
            }, { status: 500, headers: corsHeaders });
        }
    }

    return Response.json({
        success: false,
        error: 'Method not allowed'
    }, { status: 405, headers: corsHeaders });
}

export async function handleActivitySources(request) {
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
            return Response.json({
                success: true,
                sources
            }, { headers: corsHeaders });
        } catch (error) {
            return Response.json({
                success: false,
                error: error.message
            }, { status: 500, headers: corsHeaders });
        }
    }

    if (request.method === 'POST') {
        try {
            const body = await request.json();
            const source = await ActivitySourcesDB.register(body);
            return Response.json({
                success: true,
                source
            }, { headers: corsHeaders });
        } catch (error) {
            return Response.json({
                success: false,
                error: error.message
            }, { status: 500, headers: corsHeaders });
        }
    }

    if (request.method === 'DELETE') {
        try {
            const url = new URL(request.url);
            const sourceId = url.searchParams.get('id');
            
            if (!sourceId) {
                return Response.json({
                    success: false,
                    error: 'Source ID required'
                }, { status: 400, headers: corsHeaders });
            }

            await ActivitySourcesDB.delete(sourceId);
            return Response.json({
                success: true,
                message: 'Source deleted'
            }, { headers: corsHeaders });
        } catch (error) {
            return Response.json({
                success: false,
                error: error.message
            }, { status: 500, headers: corsHeaders });
        }
    }

    return Response.json({
        success: false,
        error: 'Method not allowed'
    }, { status: 405, headers: corsHeaders });
}

export async function handleActivitySettings(request) {
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
            return Response.json({
                success: true,
                settings
            }, { headers: corsHeaders });
        } catch (error) {
            return Response.json({
                success: false,
                error: error.message
            }, { status: 500, headers: corsHeaders });
        }
    }

    if (request.method === 'POST') {
        try {
            const body = await request.json();
            const settings = await ActivitySettingsDB.set(body);
            return Response.json({
                success: true,
                settings
            }, { headers: corsHeaders });
        } catch (error) {
            return Response.json({
                success: false,
                error: error.message
            }, { status: 500, headers: corsHeaders });
        }
    }

    return Response.json({
        success: false,
        error: 'Method not allowed'
    }, { status: 405, headers: corsHeaders });
}
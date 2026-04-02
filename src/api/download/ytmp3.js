const axios = require('axios');

module.exports = function(app) {
    
    // Función para limpiar URL de TikTok
    function cleanTikTokUrl(url) {
        // Eliminar parámetros innecesarios
        url = url.split('?')[0];
        // Reemplazar vm.tiktok.com con tiktok.com
        if (url.includes('vm.tiktok.com')) {
            return url;
        }
        return url;
    }

    // Función principal para descargar TikTok sin watermark
    async function downloadTikTok(url) {
        try {
            // Usar API pública de TikWM
            const response = await axios.post('https://tikwm.com/api/', 
                new URLSearchParams({
                    url: url,
                    count: 12,
                    cursor: 0,
                    web: 1,
                    hd: 1
                }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.data && response.data.code === 0) {
                const data = response.data.data;
                return {
                    success: true,
                    result: {
                        id: data.id,
                        title: data.title,
                        description: data.title,
                        duration: data.duration,
                        create_time: data.create_time,
                        region: data.region,
                        author: {
                            id: data.author.id,
                            unique_id: data.author.unique_id,
                            nickname: data.author.nickname,
                            avatar: data.author.avatar
                        },
                        music: {
                            id: data.music.id,
                            title: data.music.title,
                            author: data.music.author,
                            duration: data.music.duration,
                            play_url: data.music.play_url
                        },
                        video: {
                            no_watermark: data.play,
                            watermark: data.wmplay,
                            cover: data.cover,
                            dynamic_cover: data.dynamic_cover,
                            origin_cover: data.origin_cover,
                            width: data.width,
                            height: data.height
                        },
                        statistics: {
                            play_count: data.play_count,
                            digg_count: data.digg_count,
                            comment_count: data.comment_count,
                            share_count: data.share_count,
                            download_count: data.download_count
                        }
                    }
                };
            } else {
                throw new Error('Failed to fetch TikTok video');
            }
        } catch (error) {
            console.error('Error downloading TikTok:', error.message);
            throw new Error(`TikTok download failed: ${error.message}`);
        }
    }

    // Endpoint principal
    app.get('/download/tiktok', async (req, res) => {
        try {
            const { url } = req.query;
            
            if (!url) {
                return res.status(400).json({ 
                    status: false, 
                    error: 'URL parameter is required',
                    message: 'Please provide a TikTok video URL'
                });
            }

            // Limpiar URL
            const cleanUrl = cleanTikTokUrl(url);
            
            // Si se solicita descarga directa
            if (req.query.download === 'true') {
                try {
                    // Primero obtener información del video
                    const videoData = await downloadTikTok(cleanUrl);
                    
                    if (!videoData.success || !videoData.result.video.no_watermark) {
                        throw new Error('No video URL found');
                    }
                    
                    const videoUrl = videoData.result.video.no_watermark;
                    const author = videoData.result.author.unique_id;
                    const videoId = videoData.result.id;
                    
                    // Descargar y transmitir el video
                    const response = await axios({
                        method: 'GET',
                        url: videoUrl,
                        responseType: 'stream',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    // Configurar headers para descarga
                    res.header('Content-Disposition', `attachment; filename="tiktok_${author}_${videoId}.mp4"`);
                    res.header('Content-Type', 'video/mp4');
                    
                    // Transmitir el video
                    response.data.pipe(res);
                    
                } catch (streamError) {
                    console.error('Stream error:', streamError);
                    res.status(500).json({ 
                        status: false, 
                        error: 'Failed to stream video',
                        message: streamError.message
                    });
                }
                
            } else {
                // Obtener información del video sin descargar
                const videoData = await downloadTikTok(cleanUrl);
                
                if (!videoData.success) {
                    throw new Error('Failed to fetch video information');
                }
                
                const data = videoData.result;
                
                res.status(200).json({
                    status: true,
                    creator: "DVWILKER",
                    result: {
                        video_id: data.id,
                        title: data.title,
                        description: data.description,
                        duration: data.duration,
                        duration_formatted: formatDuration(data.duration),
                        region: data.region,
                        created_at: new Date(data.create_time * 1000).toISOString(),
                        author: {
                            username: data.author.unique_id,
                            nickname: data.author.nickname,
                            avatar: data.author.avatar,
                            profile_url: `https://www.tiktok.com/@${data.author.unique_id}`
                        },
                        music: {
                            title: data.music.title,
                            author: data.music.author,
                            duration: data.music.duration,
                            url: data.music.play_url
                        },
                        video: {
                            no_watermark_url: data.video.no_watermark,
                            watermark_url: data.video.watermark,
                            thumbnail: data.video.cover,
                            width: data.video.width,
                            height: data.video.height
                        },
                        statistics: {
                            views: data.statistics.play_count,
                            likes: data.statistics.digg_count,
                            comments: data.statistics.comment_count,
                            shares: data.statistics.share_count,
                            downloads: data.statistics.download_count
                        },
                        download_url: `/download/tiktok?url=${encodeURIComponent(url)}&download=true`
                    }
                });
            }

        } catch (error) {
            console.error('Error in TikTok endpoint:', error);
            res.status(500).json({ 
                status: false, 
                error: error.message || 'Internal server error',
                message: 'Failed to process TikTok video'
            });
        }
    });
    
    // Función auxiliar para formatear duración
    function formatDuration(seconds) {
        if (!seconds) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
};
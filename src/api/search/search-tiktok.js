const axios = require('axios');

module.exports = function(app) {
    
    async function searchTikTok(query, count = 20) {
        try {
            const response = await axios.get('https://tikwm.com/api/feed/search', {
                params: {
                    keywords: query,
                    count: count,
                    cursor: 0,
                    web: 1,
                    hd: 1
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 30000
            });

            if (!response.data || response.data.code !== 0) {
                throw new Error('No se encontraron resultados');
            }

            const videos = response.data.data.videos || [];
            
            return videos.map(video => ({
                id: video.id,
                title: video.title,
                duration: video.duration,
                play_count: video.play_count,
                digg_count: video.digg_count,
                comment_count: video.comment_count,
                share_count: video.share_count,
                author: {
                    id: video.author.id,
                    username: video.author.unique_id,
                    nickname: video.author.nickname,
                    avatar: video.author.avatar
                },
                video: {
                    no_watermark: video.play,
                    with_watermark: video.wmplay,
                    cover: video.cover,
                    dynamic_cover: video.dynamic_cover
                },
                music: {
                    id: video.music.id,
                    title: video.music.title,
                    author: video.music.author,
                    duration: video.music.duration,
                    play_url: video.music.play_url
                },
                created_at: new Date(video.create_time * 1000).toISOString()
            }));

        } catch (error) {
            throw new Error(`Error en búsqueda de TikTok: ${error.message}`);
        }
    }

    app.get('/search/tiktok', async (req, res) => {
        const { q, limit } = req.query;
        const query = q || req.query.query;
        
        if (!query) {
            return res.status(400).json({
                status: false,
                creator: 'DVWILKER',
                error: 'Query parameter is required',
                message: 'Please provide a search query: ?q=SEARCH_QUERY',
                usage: {
                    example: '/search/tiktok?q=musica'
                }
            });
        }

        const count = Math.min(parseInt(limit) || 20, 50);

        try {
            const results = await searchTikTok(query, count);

            if (results.length === 0) {
                return res.status(404).json({
                    status: false,
                    creator: 'DVWILKER',
                    error: 'No results found',
                    message: `No se encontraron videos para "${query}"`
                });
            }

            res.json({
                status: true,
                creator: 'DVWILKER',
                query: query,
                total_results: results.length,
                results: results
            });

        } catch (error) {
            console.error('TikTok search error:', error.message);
            res.status(500).json({
                status: false,
                creator: 'DVWILKER',
                error: error.message || 'Error al buscar en TikTok'
            });
        }
    });
};
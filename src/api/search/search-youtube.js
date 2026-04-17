const axios = require('axios');

module.exports = function(app) {
    
    // Función para obtener API key (opcional, puedes ponerla directamente)
    function getYouTubeApiKey() {
        // Puedes poner tu API key aquí directamente o usar variable de entorno
        return process.env.YOUTUBE_API_KEY || 'AIzaSyDBrbDJAhuamM54a8hLGkUlAC8qcUKS3ss';
    }

    function formatDuration(isoDuration) {
        if (!isoDuration) return "00:00";

        const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return "00:00";

        const hours = parseInt(match[1] || 0, 10);
        const minutes = parseInt(match[2] || 0, 10);
        const seconds = parseInt(match[3] || 0, 10);

        const totalMinutes = hours * 60 + minutes;
        return `${totalMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function formatPublishedAt(dateString) {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    app.get('/search/youtube', async (req, res) => {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({
                status: false,
                creator: 'DVWILKER',
                error: 'El parámetro "q" es requerido.',
                message: 'Please provide a search query: ?q=SEARCH_QUERY'
            });
        }

        try {
            const API_KEY = getYouTubeApiKey();
            
            if (!API_KEY) {
                return res.status(503).json({
                    status: false,
                    creator: 'DVWILKER',
                    error: 'YouTube API no está configurada.',
                    message: 'Define YOUTUBE_API_KEY en variables de entorno o agrega tu API key en el código.'
                });
            }

            const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&q=${encodeURIComponent(q)}&key=${API_KEY}`;
            const searchRes = await axios.get(searchUrl);

            if (!searchRes.data.items || searchRes.data.items.length === 0) {
                return res.status(404).json({
                    status: false,
                    creator: 'DVWILKER',
                    error: 'No se encontraron resultados',
                    message: 'No videos found for your search query'
                });
            }

            const videoIds = searchRes.data.items.map(item => item.id.videoId).join(',');
            const channelIds = searchRes.data.items.map(item => item.snippet.channelId);

            const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${API_KEY}`;
            const videosRes = await axios.get(videosUrl);

            const uniqueChannelIds = [...new Set(channelIds)].join(',');
            const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${uniqueChannelIds}&key=${API_KEY}`;
            const channelsRes = await axios.get(channelsUrl);

            const channelMap = {};
            channelsRes.data.items.forEach(channel => {
                channelMap[channel.id] = channel.statistics.subscriberCount;
            });

            const ytTracks = videosRes.data.items.map(video => ({
                title: video.snippet.title,
                description: video.snippet.description,
                channel: video.snippet.channelTitle,
                channelId: video.snippet.channelId,
                subscribers: channelMap[video.snippet.channelId] || "N/A",
                publishedAt: formatPublishedAt(video.snippet.publishedAt),
                duration: formatDuration(video.contentDetails.duration),
                views: video.statistics.viewCount || 0,
                likes: video.statistics.likeCount || 0,
                comments: video.statistics.commentCount || 0,
                thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
                url: `https://www.youtube.com/watch?v=${video.id}`
            }));

            res.status(200).json({
                status: true,
                creator: 'DVWILKER',
                query: q,
                total_results: ytTracks.length,
                result: ytTracks
            });

        } catch (error) {
            console.error('YouTube API Error:', error.response?.data || error.message);
            res.status(500).json({
                status: false,
                creator: 'DVWILKER',
                error: 'Ocurrió un error en el servidor.',
                message: error.response?.data?.error?.message || error.message
            });
        }
    });
};
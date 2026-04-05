const ytdl = require('ytdl-core');

module.exports = function(app) {
    
    // Función para limpiar título
    function cleanTitle(title) {
        return title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_').substring(0, 100);
    }
    
    // Endpoint para MP3
    app.get('/download/ytmp3', async (req, res) => {
        try {
            const { url } = req.query;
            
            if (!url) {
                return res.status(400).json({ 
                    status: false, 
                    error: 'URL is required' 
                });
            }
            
            // Validar URL
            if (!ytdl.validateURL(url)) {
                return res.status(400).json({ 
                    status: false, 
                    error: 'Invalid YouTube URL' 
                });
            }
            
            // Configurar timeout
            const requestTimeout = setTimeout(() => {
                if (!res.headersSent) {
                    res.status(504).json({ status: false, error: 'Request timeout' });
                }
            }, 30000);
            
            // Obtener información del video
            const info = await ytdl.getInfo(url, {
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            });
            
            clearTimeout(requestTimeout);
            
            const videoDetails = info.videoDetails;
            const duration = parseInt(videoDetails.lengthSeconds);
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            const durationFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Si es descarga directa
            if (req.query.download === 'true') {
                const title = cleanTitle(videoDetails.title);
                
                res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
                res.header('Content-Type', 'audio/mpeg');
                res.header('Cache-Control', 'no-cache');
                
                const stream = ytdl(url, {
                    quality: 'highestaudio',
                    filter: 'audioonly',
                    requestOptions: {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    }
                });
                
                stream.on('error', (err) => {
                    console.error('Stream error:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ status: false, error: err.message });
                    }
                });
                
                stream.pipe(res);
                
            } else {
                // Solo información
                res.json({
                    status: true,
                    creator: "DVWILKER",
                    result: {
                        title: videoDetails.title,
                        author: videoDetails.author.name,
                        duration: duration,
                        duration_formatted: durationFormatted,
                        thumbnail: videoDetails.thumbnails?.slice(-1)[0]?.url || `https://img.youtube.com/vi/${videoDetails.videoId}/maxresdefault.jpg`,
                        video_id: videoDetails.videoId,
                        download_url: `/download/ytmp3?url=${encodeURIComponent(url)}&download=true`
                    }
                });
            }
            
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ 
                status: false, 
                error: error.message || 'Internal error',
                solution: 'Try using a different URL or try again later'
            });
        }
    });
    
    // Endpoint para MP4
    app.get('/download/ytmp4', async (req, res) => {
        try {
            const { url, quality = '18' } = req.query;
            
            if (!url) {
                return res.status(400).json({ 
                    status: false, 
                    error: 'URL is required' 
                });
            }
            
            if (!ytdl.validateURL(url)) {
                return res.status(400).json({ 
                    status: false, 
                    error: 'Invalid YouTube URL' 
                });
            }
            
            const info = await ytdl.getInfo(url, {
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            });
            
            const title = cleanTitle(info.videoDetails.title);
            
            // Calidades: 18=360p, 22=720p, 37=1080p
            const qualities = {
                '360': '18',
                '720': '22',
                '1080': '37'
            };
            
            const formatCode = qualities[quality] || '18';
            
            if (req.query.download === 'true') {
                res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
                res.header('Content-Type', 'video/mp4');
                
                const stream = ytdl(url, {
                    quality: formatCode,
                    filter: 'videoandaudio',
                    requestOptions: {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    }
                });
                
                stream.on('error', (err) => {
                    console.error('Stream error:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ status: false, error: err.message });
                    }
                });
                
                stream.pipe(res);
                
            } else {
                res.json({
                    status: true,
                    creator: "DVWILKER",
                    result: {
                        title: info.videoDetails.title,
                        author: info.videoDetails.author.name,
                        duration: info.videoDetails.lengthSeconds,
                        thumbnail: `https://img.youtube.com/vi/${info.videoDetails.videoId}/maxresdefault.jpg`,
                        video_id: info.videoDetails.videoId,
                        available_qualities: ['360', '720', '1080'],
                        download_url: `/download/ytmp4?url=${encodeURIComponent(url)}&quality=720&download=true`
                    }
                });
            }
            
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ 
                status: false, 
                error: error.message 
            });
        }
    });
};
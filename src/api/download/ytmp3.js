const ytdl = require('ytdl-core');

module.exports = function(app) {
    
    // Función para limpiar título
    function cleanTitle(title) {
        return title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
    }
    
    // Endpoint para MP3
    app.get('/download/ytmp3', async (req, res) => {
        try {
            const { url } = req.query;
            
            if (!url) {
                return res.status(400).json({ 
                    status: false, 
                    error: 'URL is required',
                    message: 'Please provide a YouTube URL'
                });
            }
            
            // Validar URL
            if (!ytdl.validateURL(url)) {
                return res.status(400).json({ 
                    status: false, 
                    error: 'Invalid YouTube URL'
                });
            }
            
            // Obtener información del video
            const info = await ytdl.getInfo(url);
            const title = cleanTitle(info.videoDetails.title);
            const duration = parseInt(info.videoDetails.lengthSeconds);
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            const durationFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Si es descarga directa
            if (req.query.download === 'true') {
                res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
                res.header('Content-Type', 'audio/mpeg');
                
                ytdl(url, {
                    quality: 'highestaudio',
                    filter: 'audioonly'
                }).pipe(res);
                
            } else {
                // Solo información
                res.json({
                    status: true,
                    creator: "DVWILKER",
                    result: {
                        title: info.videoDetails.title,
                        author: info.videoDetails.author.name,
                        duration: duration,
                        duration_formatted: durationFormatted,
                        thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1]?.url || `https://img.youtube.com/vi/${info.videoDetails.videoId}/maxresdefault.jpg`,
                        video_id: info.videoDetails.videoId,
                        download_url: `/download/ytmp3?url=${encodeURIComponent(url)}&download=true`
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
    
    // Endpoint para MP4 (video)
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
            
            const info = await ytdl.getInfo(url);
            const title = cleanTitle(info.videoDetails.title);
            
            // Calidades: 18 = 360p, 22 = 720p, 37 = 1080p
            const qualities = {
                '360': '18',
                '720': '22', 
                '1080': '37'
            };
            
            const format = qualities[quality] || '18';
            
            if (req.query.download === 'true') {
                res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
                res.header('Content-Type', 'video/mp4');
                
                ytdl(url, {
                    quality: format,
                    filter: 'videoandaudio'
                }).pipe(res);
                
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
            res.status(500).json({ 
                status: false, 
                error: error.message 
            });
        }
    });
};
const ytdl = require('ytdl-core');

module.exports = function(app) {
    
    // Función para limpiar título de archivo
    function sanitizeTitle(title) {
        return title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
    }

    // Función para formatear duración
    function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    app.get('/download/ytaudio', async (req, res) => {
        try {
            const { url } = req.query;
            
            if (!url) {
                return res.status(400).json({ 
                    status: false, 
                    error: 'URL parameter is required',
                    message: 'Please provide a YouTube URL'
                });
            }

            // Validar URL de YouTube
            if (!ytdl.validateURL(url)) {
                return res.status(400).json({ 
                    status: false, 
                    error: 'Invalid YouTube URL',
                    message: 'Please provide a valid YouTube URL'
                });
            }

            // Si se solicita descarga directa
            if (req.query.download === 'true') {
                try {
                    const info = await ytdl.getInfo(url);
                    const title = sanitizeTitle(info.videoDetails.title);
                    
                    // Configurar headers para descarga
                    res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
                    res.header('Content-Type', 'audio/mpeg');
                    
                    // Transmitir el audio directamente
                    ytdl(url, {
                        quality: 'highestaudio',
                        filter: 'audioonly'
                    }).pipe(res);
                    
                } catch (streamError) {
                    console.error('Stream error:', streamError);
                    res.status(500).json({ 
                        status: false, 
                        error: 'Failed to stream audio',
                        message: streamError.message
                    });
                }
                
            } else {
                // Obtener información del video sin descargar
                const info = await ytdl.getInfo(url);
                const videoDetails = info.videoDetails;
                
                // Obtener duración formateada
                const durationSeconds = parseInt(videoDetails.lengthSeconds);
                const durationFormatted = formatDuration(durationSeconds);
                
                // Obtener la mejor miniatura
                const thumbnail = videoDetails.thumbnails && videoDetails.thumbnails.length > 0 
                    ? videoDetails.thumbnails[videoDetails.thumbnails.length - 1].url 
                    : null;
                
                res.status(200).json({
                    status: true,
                    creator: "DVWILKER",
                    result: {
                        title: videoDetails.title,
                        duration: durationSeconds,
                        duration_formatted: durationFormatted,
                        thumbnail: thumbnail,
                        author: videoDetails.author.name,
                        author_url: videoDetails.author.channel_url,
                        views: parseInt(videoDetails.viewCount) || 0,
                        published: videoDetails.publishDate || 'Unknown',
                        video_url: videoDetails.video_url,
                        download_url: `/download/ytaudio?url=${encodeURIComponent(url)}&download=true`
                    }
                });
            }

        } catch (error) {
            console.error('Error in ytmp3 endpoint:', error);
            res.status(500).json({ 
                status: false, 
                error: error.message || 'Internal server error',
                message: 'Failed to process YouTube video'
            });
        }
    });
};
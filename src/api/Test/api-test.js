module.exports = function(app) {
    
    // Endpoint de prueba
    app.get('/test', (req, res) => {
        res.json({
            status: true,
            message: "API funcionando correctamente",
            timestamp: new Date().toISOString()
        });
    });
    
    // Endpoint para probar ytdl-core
    app.get('/test-yt', async (req, res) => {
        try {
            const ytdl = require('ytdl-core');
            const url = req.query.url || 'https://youtu.be/dQw4w9WgXcQ';
            
            const isValid = ytdl.validateURL(url);
            
            if (!isValid) {
                return res.json({
                    status: false,
                    error: "Invalid YouTube URL",
                    url: url
                });
            }
            
            const info = await ytdl.getInfo(url);
            
            res.json({
                status: true,
                video_title: info.videoDetails.title,
                video_id: info.videoDetails.videoId,
                duration: info.videoDetails.lengthSeconds,
                author: info.videoDetails.author.name
            });
            
        } catch (error) {
            res.json({
                status: false,
                error: error.message,
                stack: error.stack
            });
        }
    });
};
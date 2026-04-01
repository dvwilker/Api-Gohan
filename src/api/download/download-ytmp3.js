module.exports = function(app) {
    const ytdl = require('ytdl-core');
    
    app.get('/download/ytmp3', async (req, res) => {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ status: false, error: 'URL is required' });
        }
        
        try {
            // Validar URL de YouTube
            if (!ytdl.validateURL(url)) {
                return res.status(400).json({ status: false, error: 'Invalid YouTube URL' });
            }
            
            // Obtener información del video
            const info = await ytdl.getInfo(url);
            const title = info.videoDetails.title;
            
            // Configurar headers para descarga
            res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^\w\s]/gi, '')}.mp3"`);
            res.setHeader('Content-Type', 'audio/mpeg');
            
            // Descargar solo audio
            ytdl(url, { quality: 'highestaudio', filter: 'audioonly' })
                .pipe(res);
                
        } catch (error) {
            res.status(500).json({ status: false, error: error.message });
        }
    });
}
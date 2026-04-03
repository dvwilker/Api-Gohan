const axios = require('axios');
const cheerio = require('cheerio');

module.exports = function(app) {
    
    // Función para extraer ID de YouTube
    function extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=)([^&]+)/,
            /(?:youtu\.be\/)([^?]+)/,
            /(?:youtube\.com\/shorts\/)([^?]+)/,
            /(?:youtube\.com\/embed\/)([^?]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    // Función para descargar video de ytdown
    async function downloadVideoFromYtDown(url, quality = '720') {
        try {
            // Paso 1: Obtener la página principal con cookies
            const mainPage = await axios.get('https://app.ytdown.to/es23/', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Referer': 'https://app.ytdown.to/',
                    'Origin': 'https://app.ytdown.to',
                    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                    'Upgrade-Insecure-Requests': '1'
                }
            });
            
            // Extraer cookies
            const cookies = mainPage.headers['set-cookie'];
            let cookieString = '';
            if (cookies) {
                cookieString = cookies.map(c => c.split(';')[0]).join('; ');
            }
            
            // Extraer token CSRF si existe
            const $ = cheerio.load(mainPage.data);
            let csrfToken = '';
            const metaCsrf = $('meta[name="csrf-token"]').attr('content');
            if (metaCsrf) csrfToken = metaCsrf;
            
            // Paso 2: Enviar URL para obtener información del video
            const formData = new URLSearchParams();
            formData.append('url', url);
            
            const infoResponse = await axios.post('https://app.ytdown.to/es23/api/info', formData, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'Referer': 'https://app.ytdown.to/es23/',
                    'Origin': 'https://app.ytdown.to',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Cookie': cookieString,
                    'X-CSRF-TOKEN': csrfToken
                }
            });
            
            if (!infoResponse.data || infoResponse.data.status !== 'success') {
                throw new Error(infoResponse.data?.message || 'Failed to get video info');
            }
            
            const videoData = infoResponse.data;
            
            // Paso 3: Obtener URL de descarga de video (MP4)
            const downloadFormData = new URLSearchParams();
            downloadFormData.append('video_id', videoData.video_id);
            downloadFormData.append('type', 'mp4');
            downloadFormData.append('quality', quality);
            
            const downloadResponse = await axios.post('https://app.ytdown.to/es23/api/download', downloadFormData, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'Referer': 'https://app.ytdown.to/es23/',
                    'Origin': 'https://app.ytdown.to',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Cookie': cookieString,
                    'X-CSRF-TOKEN': csrfToken
                }
            });
            
            if (!downloadResponse.data || downloadResponse.data.status !== 'success') {
                throw new Error('Failed to get download URL');
            }
            
            // Obtener formatos disponibles
            const formats = [];
            if (videoData.formats) {
                if (videoData.formats.mp4) {
                    formats.push({ quality: '360', label: '360p', type: 'mp4' });
                    formats.push({ quality: '720', label: '720p HD', type: 'mp4' });
                    formats.push({ quality: '1080', label: '1080p Full HD', type: 'mp4' });
                }
            }
            
            return {
                success: true,
                title: videoData.title,
                thumbnail: videoData.thumbnail,
                duration: videoData.duration,
                author: videoData.author,
                video_id: videoData.video_id,
                description: videoData.description || '',
                views: videoData.views || 0,
                formats: formats,
                download_url: downloadResponse.data.download_url,
                quality_used: quality
            };
            
        } catch (error) {
            console.error('YtDown video error:', error.response?.data || error.message);
            throw new Error(`Video download failed: ${error.message}`);
        }
    }

    // Endpoint principal para MP4
    app.get('/download/ytmp4', async (req, res) => {
        try {
            const { url, quality } = req.query;
            
            if (!url) {
                return res.status(400).json({ 
                    status: false, 
                    error: 'URL parameter is required',
                    message: 'Please provide a YouTube URL'
                });
            }
            
            // Validar URL de YouTube
            const videoId = extractVideoId(url);
            if (!videoId) {
                return res.status(400).json({ 
                    status: false, 
                    error: 'Invalid YouTube URL',
                    message: 'Please provide a valid YouTube URL'
                });
            }
            
            // Calidades disponibles: 360, 720, 1080
            const validQualities = ['360', '720', '1080'];
            const selectedQuality = validQualities.includes(quality) ? quality : '720';
            
            // Si se solicita descarga directa
            if (req.query.download === 'true') {
                try {
                    const result = await downloadVideoFromYtDown(`https://youtube.com/watch?v=${videoId}`, selectedQuality);
                    
                    if (!result.download_url) {
                        throw new Error('No download URL found');
                    }
                    
                    // Redirigir a la URL de descarga
                    return res.redirect(result.download_url);
                    
                } catch (streamError) {
                    console.error('Download error:', streamError);
                    return res.status(500).json({ 
                        status: false, 
                        error: 'Failed to get download URL',
                        message: streamError.message
                    });
                }
            }
            
            // Obtener información del video
            const result = await downloadVideoFromYtDown(`https://youtube.com/watch?v=${videoId}`, selectedQuality);
            
            // Formatear duración
            let durationFormatted = result.duration || '0:00';
            if (typeof result.duration === 'number') {
                const minutes = Math.floor(result.duration / 60);
                const seconds = result.duration % 60;
                durationFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
            
            // Formatear vistas
            let viewsFormatted = 'N/A';
            if (result.views > 0) {
                if (result.views >= 1000000) {
                    viewsFormatted = (result.views / 1000000).toFixed(1) + 'M';
                } else if (result.views >= 1000) {
                    viewsFormatted = (result.views / 1000).toFixed(1) + 'K';
                } else {
                    viewsFormatted = result.views.toString();
                }
            }
            
            res.status(200).json({
                status: true,
                creator: "DVWILKER",
                result: {
                    title: result.title,
                    author: result.author,
                    video_id: result.video_id,
                    duration: result.duration,
                    duration_formatted: durationFormatted,
                    thumbnail: result.thumbnail,
                    description: result.description,
                    views: result.views,
                    views_formatted: viewsFormatted,
                    quality: selectedQuality + 'p',
                    format: "MP4",
                    available_qualities: result.formats,
                    download_url: `/download/ytmp4?url=https://youtube.com/watch?v=${videoId}&quality=${selectedQuality}&download=true`
                }
            });
            
        } catch (error) {
            console.error('Error in ytmp4 endpoint:', error);
            res.status(500).json({ 
                status: false, 
                error: error.message || 'Internal server error',
                message: 'Failed to process YouTube video. Please try again later.'
            });
        }
    });
};
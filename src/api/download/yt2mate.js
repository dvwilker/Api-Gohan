const axios = require('axios');
const cheerio = require('cheerio');

module.exports = function(app) {
    
    // Extraer ID de YouTube
    function extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=)([^&]+)/,
            /(?:youtu\.be\/)([^?]+)/,
            /(?:youtube\.com\/shorts\/)([^?]+)/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    // Función principal para obtener datos de y2mate
    async function getY2mateData(videoId) {
        try {
            // Paso 1: Obtener página principal para cookies y token
            const mainPage = await axios.get('https://y2mate.sc/es/', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br'
                }
            });
            
            // Extraer cookies
            const cookies = mainPage.headers['set-cookie'];
            let cookieString = '';
            if (cookies) {
                cookieString = cookies.map(c => c.split(';')[0]).join('; ');
            }
            
            // Extraer token CSRF del HTML
            const $ = cheerio.load(mainPage.data);
            let csrfToken = '';
            const csrfMeta = $('meta[name="csrf-token"]').attr('content');
            if (csrfMeta) csrfToken = csrfMeta;
            
            // Paso 2: Enviar solicitud para obtener análisis del video
            const analyzeResponse = await axios.post('https://y2mate.sc/es/analyze/ajax', 
                new URLSearchParams({
                    k_query: `https://youtube.com/watch?v=${videoId}`,
                    k_page: 'home',
                    hl: 'es',
                    q_auto: 0
                }), {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Cookie': cookieString,
                    'X-CSRF-TOKEN': csrfToken
                }
            });
            
            if (!analyzeResponse.data || !analyzeResponse.data.result) {
                throw new Error('Failed to analyze video');
            }
            
            // Cargar el HTML de resultados
            const resultHtml = analyzeResponse.data.result;
            const $$ = cheerio.load(resultHtml);
            
            // Extraer información del video
            const title = $$('.caption-title').text().trim();
            const thumbnail = $$('.thumbnail img').attr('src');
            
            // Extraer formatos disponibles
            const formats = {
                mp3: [],
                mp4: []
            };
            
            // Extraer MP3 (audio)
            $$('div[data-quality="mp3"]').each((i, el) => {
                const quality = $$(el).find('a').attr('data-fquality') || '128';
                const size = $$(el).find('.fsize').text();
                const k = $$(el).find('a').attr('data-k');
                
                if (k) {
                    formats.mp3.push({
                        quality: `${quality}kbps`,
                        size: size,
                        k: k
                    });
                }
            });
            
            // Extraer MP4 (video)
            $$('div[data-quality="mp4"]').each((i, el) => {
                const quality = $$(el).find('a').attr('data-fquality') || '360';
                const size = $$(el).find('.fsize').text();
                const k = $$(el).find('a').attr('data-k');
                
                if (k) {
                    formats.mp4.push({
                        quality: `${quality}p`,
                        size: size,
                        k: k
                    });
                }
            });
            
            if (formats.mp3.length === 0 && formats.mp4.length === 0) {
                throw new Error('No formats available');
            }
            
            return {
                success: true,
                videoId: videoId,
                title: title,
                thumbnail: thumbnail,
                formats: formats,
                cookie: cookieString,
                csrf: csrfToken
            };
            
        } catch (error) {
            console.error('Y2mate error:', error.message);
            throw new Error(`Y2mate failed: ${error.message}`);
        }
    }
    
    // Función para obtener URL de descarga
    async function getDownloadUrl(k, cookieString, csrfToken) {
        try {
            const response = await axios.post('https://y2mate.sc/es/convert/ajax',
                new URLSearchParams({
                    k: k,
                    _token: csrfToken
                }), {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Cookie': cookieString,
                    'X-CSRF-TOKEN': csrfToken
                }
            });
            
            if (response.data && response.data.result) {
                const $ = cheerio.load(response.data.result);
                const downloadLink = $('a').attr('href');
                if (downloadLink) {
                    return downloadLink;
                }
            }
            throw new Error('No download URL found');
        } catch (error) {
            throw new Error(`Failed to get download URL: ${error.message}`);
        }
    }

    // Endpoint principal para descargar
    app.get('/download/y2mate', async (req, res) => {
        try {
            const { url, format = 'mp3', quality } = req.query;
            
            if (!url) {
                return res.status(400).json({
                    status: false,
                    error: 'URL is required',
                    message: 'Please provide a YouTube URL'
                });
            }
            
            const videoId = extractVideoId(url);
            if (!videoId) {
                return res.status(400).json({
                    status: false,
                    error: 'Invalid YouTube URL'
                });
            }
            
            // Obtener datos del video
            const videoData = await getY2mateData(videoId);
            
            // Determinar qué formato usar
            let selectedFormat;
            if (format === 'mp3') {
                if (quality) {
                    selectedFormat = videoData.formats.mp3.find(f => f.quality === `${quality}kbps`);
                }
                if (!selectedFormat && videoData.formats.mp3.length > 0) {
                    selectedFormat = videoData.formats.mp3[0]; // 128kbps por defecto
                }
            } else if (format === 'mp4') {
                if (quality) {
                    selectedFormat = videoData.formats.mp4.find(f => f.quality === `${quality}p`);
                }
                if (!selectedFormat && videoData.formats.mp4.length > 0) {
                    selectedFormat = videoData.formats.mp4[0]; // 360p por defecto
                }
            }
            
            if (!selectedFormat) {
                return res.status(404).json({
                    status: false,
                    error: 'Format not available',
                    available_formats: {
                        mp3: videoData.formats.mp3.map(f => f.quality),
                        mp4: videoData.formats.mp4.map(f => f.quality)
                    }
                });
            }
            
            // Si es descarga directa
            if (req.query.download === 'true') {
                const downloadUrl = await getDownloadUrl(selectedFormat.k, videoData.cookie, videoData.csrf);
                if (downloadUrl) {
                    return res.redirect(downloadUrl);
                }
                throw new Error('No download URL generated');
            }
            
            // Devolver información
            res.json({
                status: true,
                creator: "DVWILKER",
                result: {
                    title: videoData.title,
                    video_id: videoId,
                    thumbnail: videoData.thumbnail,
                    format: format.toUpperCase(),
                    quality: selectedFormat.quality,
                    size: selectedFormat.size,
                    available_formats: {
                        mp3: videoData.formats.mp3.map(f => ({
                            quality: f.quality,
                            size: f.size
                        })),
                        mp4: videoData.formats.mp4.map(f => ({
                            quality: f.quality,
                            size: f.size
                        }))
                    },
                    download_url: `/download/y2mate?url=${encodeURIComponent(url)}&format=${format}&quality=${selectedFormat.quality.replace('kbps', '').replace('p', '')}&download=true`
                }
            });
            
        } catch (error) {
            console.error('Y2mate API Error:', error);
            res.status(500).json({
                status: false,
                error: error.message || 'Failed to process video'
            });
        }
    });
};
const axios = require('axios');
const FormData = require('form-data');

module.exports = function(app) {
    
    // Endpoint para subir archivos
    app.post('/cdn/gohan-file', async (req, res) => {
        try {
            // Verificar si viene un archivo en la petición
            if (!req.files || !req.files.file) {
                return res.status(400).json({
                    status: false,
                    creator: 'DVWILKER',
                    error: 'No file uploaded',
                    message: 'Please send a file using multipart/form-data with key "file"'
                });
            }

            const file = req.files.file;
            
            // Crear FormData para enviar a Gohan File
            const form = new FormData();
            form.append('file', file.data, {
                filename: file.name,
                contentType: file.mimetype
            });

            // Subir a Gohan File
            const response = await axios.post('https://gohan-file-cdn.onrender.com/upload', form, {
                headers: {
                    ...form.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            // Extraer URL del archivo subido
            let fileUrl = null;
            if (response.data && response.data.url) {
                fileUrl = response.data.url;
            } else if (response.data && response.data.fileUrl) {
                fileUrl = response.data.fileUrl;
            } else if (response.data && response.data.link) {
                fileUrl = response.data.link;
            } else {
                // Intentar extraer del HTML
                const match = response.data.match(/https?:\/\/[^\s"']+\.\w+/);
                if (match) fileUrl = match[0];
            }

            if (!fileUrl) {
                throw new Error('Could not extract file URL from response');
            }

            res.json({
                status: true,
                creator: 'DVWILKER',
                result: {
                    original_name: file.name,
                    size: file.size,
                    mimetype: file.mimetype,
                    download_url: fileUrl,
                    message: 'File uploaded successfully to Gohan File CDN'
                }
            });

        } catch (error) {
            console.error('Upload error:', error.message);
            res.status(500).json({
                status: false,
                creator: 'DVWILKER',
                error: error.message || 'Failed to upload file'
            });
        }
    });

    // Endpoint para obtener información (si la página tuviera API pública)
    app.get('/cdn/gohan-file/info', async (req, res) => {
        res.json({
            status: true,
            creator: 'DVWILKER',
            message: 'Gohan File CDN - Upload files using POST /cdn/gohan-file',
            usage: {
                method: 'POST',
                url: '/cdn/gohan-file',
                body: 'multipart/form-data with key "file"',
                example: 'curl -X POST -F "file=@/path/to/file.jpg" https://tu-api.onrender.com/cdn/gohan-file'
            }
        });
    });
};
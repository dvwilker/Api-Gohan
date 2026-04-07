const axios = require('axios');
const FormData = require('form-data');

module.exports = function(app) {
    
    // Endpoint GET - Muestra información
    app.get('/cdn/gohan-file', async (req, res) => {
        res.json({
            status: true,
            creator: 'DVWILKER',
            message: 'Gohan File CDN - Usa POST para subir archivos',
            method: 'POST',
            endpoint: '/cdn/gohan-file',
            usage: {
                example: 'curl -X POST -F "file=@imagen.jpg" https://api-gohan.onrender.com/cdn/gohan-file'
            }
        });
    });

    // Endpoint POST - Subir archivos
    app.post('/cdn/gohan-file', async (req, res) => {
        try {
            if (!req.files || !req.files.file) {
                return res.status(400).json({
                    status: false,
                    error: 'No file uploaded',
                    message: 'Envía un archivo con el campo "file"'
                });
            }

            const file = req.files.file;
            
            const form = new FormData();
            form.append('file', file.data, {
                filename: file.name,
                contentType: file.mimetype
            });

            const response = await axios.post('https://gohan-file-cdn.onrender.com/upload', form, {
                headers: {
                    ...form.getHeaders(),
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            let fileUrl = response.data?.url || response.data?.download_url || null;

            res.json({
                status: true,
                creator: 'DVWILKER',
                result: {
                    original_name: file.name,
                    size: file.size,
                    mimetype: file.mimetype,
                    download_url: fileUrl
                }
            });

        } catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    });
};
const axios = require('axios');
const FormData = require('form-data');

module.exports = function(app) {
    
    app.post('/tools/image-hd', async (req, res) => {
        try {
            if (!req.files || !req.files.image) {
                return res.status(400).json({
                    status: false,
                    creator: 'DVWILKER',
                    error: 'No image uploaded',
                    usage: {
                        method: 'POST',
                        url: '/tools/image-hd',
                        body: 'form-data con key "image"',
                        example: 'curl -X POST -F "image=@foto.jpg" https://tu-api.onrender.com/tools/image-hd'
                    }
                });
            }

            const imageFile = req.files.image;
            
            if (imageFile.size > 10 * 1024 * 1024) {
                return res.status(400).json({
                    status: false,
                    creator: 'DVWILKER',
                    error: 'Image too large',
                    message: 'La imagen no puede superar los 10MB'
                });
            }

            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(imageFile.mimetype)) {
                return res.status(400).json({
                    status: false,
                    creator: 'DVWILKER',
                    error: 'Invalid format',
                    message: 'Solo se aceptan JPG, PNG o WEBP'
                });
            }

            const form = new FormData();
            form.append('image', imageFile.data, {
                filename: imageFile.name,
                contentType: imageFile.mimetype
            });

            const response = await axios.post('https://api.deepai.org/api/torch-srgan', form, {
                headers: form.getHeaders(),
                timeout: 30000
            });

            if (!response.data || !response.data.output_url) {
                throw new Error('No se pudo mejorar la imagen');
            }

            if (req.query.download === 'true') {
                const imageResponse = await axios.get(response.data.output_url, {
                    responseType: 'arraybuffer'
                });
                res.setHeader('Content-Type', 'image/jpeg');
                res.setHeader('Content-Disposition', `attachment; filename="hd_${imageFile.name.replace(/\.[^/.]+$/, '')}.jpg"`);
                return res.send(Buffer.from(imageResponse.data));
            }

            res.json({
                status: true,
                creator: 'DVWILKER',
                result: {
                    original_name: imageFile.name,
                    original_size: imageFile.size,
                    original_size_mb: (imageFile.size / (1024 * 1024)).toFixed(2),
                    enhanced_url: response.data.output_url,
                    message: 'Imagen mejorada a HD'
                }
            });

        } catch (error) {
            console.error('Error:', error.message);
            res.status(500).json({
                status: false,
                creator: 'DVWILKER',
                error: error.message || 'Error al mejorar la imagen'
            });
        }
    });
};
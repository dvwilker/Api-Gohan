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
            const scale = req.query.scale || '2';
            
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(imageFile.mimetype)) {
                return res.status(400).json({
                    status: false,
                    creator: 'DVWILKER',
                    error: 'Invalid format',
                    message: 'Solo se aceptan imágenes JPG o PNG'
                });
            }

            const form = new FormData();
            form.append('image', imageFile.data, {
                filename: imageFile.name,
                contentType: imageFile.mimetype
            });
            form.append('scale', scale);

            const response = await axios.post('https://api2.pixelcut.app/image/upscale/v1', form, {
                headers: {
                    ...form.getHeaders(),
                    'accept': 'application/json',
                    'x-client-version': 'web',
                    'x-locale': 'es'
                },
                timeout: 60000
            });

            if (!response.data || !response.data.result_url) {
                throw new Error('No se pudo obtener la imagen mejorada');
            }

            if (req.query.download === 'true') {
                const imageResponse = await axios.get(response.data.result_url, {
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
                    scale: scale + 'x',
                    enhanced_url: response.data.result_url,
                    message: 'Imagen mejorada exitosamente'
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
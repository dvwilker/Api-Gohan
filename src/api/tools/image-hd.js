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
                        example: 'curl -X POST -F "image=@foto.jpg" https://api-gohan.onrender.com/tools/image-hd'
                    }
                });
            }

            const imageFile = req.files.image;
            
            if (imageFile.size > 10 * 1024 * 1024) {
                return res.status(400).json({
                    status: false,
                    error: 'Image too large',
                    message: 'La imagen no puede superar los 10MB'
                });
            }

            const form = new FormData();
            form.append('image', imageFile.data, {
                filename: imageFile.name,
                contentType: imageFile.mimetype
            });

            // DeepAI - Torch-SRGAN (mejora de imágenes)
            const response = await axios.post('https://api.deepai.org/api/torch-srgan', form, {
                headers: form.getHeaders(),
                timeout: 30000
            });

            if (response.data && response.data.output_url) {
                if (req.query.download === 'true') {
                    const imageResponse = await axios.get(response.data.output_url, {
                        responseType: 'arraybuffer'
                    });
                    res.setHeader('Content-Type', 'image/jpeg');
                    res.setHeader('Content-Disposition', `attachment; filename="hd_${imageFile.name.replace(/\.[^/.]+$/, '')}.jpg"`);
                    return res.send(Buffer.from(imageResponse.data));
                }

                return res.json({
                    status: true,
                    creator: 'DVWILKER',
                    result: {
                        original_name: imageFile.name,
                        enhanced_url: response.data.output_url,
                        message: 'Imagen mejorada a HD'
                    }
                });
            }

            throw new Error('No se pudo mejorar la imagen');

        } catch (error) {
            console.error('Error:', error.message);
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    });
};
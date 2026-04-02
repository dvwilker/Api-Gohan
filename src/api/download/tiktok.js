const axios = require('axios')
const fs = require('fs')
const path = require('path')

module.exports = function(app) {
    app.get('/download/tiktok', async (req, res) => {
        const { url } = req.query

        if (!url) {
            return res.status(400).json({
                status: false,
                error: 'URL is required'
            })
        }

        try {
            // API pública para quitar marca de agua
            const api = `https://tikwm.com/api/?url=${encodeURIComponent(url)}`
            const { data } = await axios.get(api)

            if (!data || !data.data || !data.data.play) {
                return res.status(500).json({
                    status: false,
                    error: 'No se pudo obtener el video'
                })
            }

            const videoUrl = data.data.play

            const fileName = `${Date.now()}_tiktok.mp4`
            const filePath = path.join(__dirname, '../../../download', fileName)

            const response = await axios({
                url: videoUrl,
                method: 'GET',
                responseType: 'stream'
            })

            const writer = fs.createWriteStream(filePath)

            response.data.pipe(writer)

            writer.on('finish', () => {
                res.download(filePath, fileName, () => {
                    fs.unlink(filePath, () => {}) // borrar después
                })
            })

            writer.on('error', (err) => {
                res.status(500).json({
                    status: false,
                    error: err.message
                })
            })

        } catch (err) {
            res.status(500).json({
                status: false,
                error: err.message
            })
        }
    })
}
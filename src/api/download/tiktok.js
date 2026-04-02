const axios = require('axios')
const fs = require('fs')
const path = require('path')

module.exports = function(app) {
    app.get('/download/tiktok', async (req, res) => {
        const { url } = req.query

        if (!url) {
            return res.status(400).json({ status: false })
        }

        try {
            const { data } = await axios.get(`https://www.tikwm.com/api/?url=${url}`)

            const video = data?.data?.play

            if (!video) throw new Error('No video')

            const filePath = path.join(__dirname, '../../../download', `${Date.now()}.mp4`)

            const response = await axios({
                url: video,
                method: 'GET',
                responseType: 'stream'
            })

            const writer = fs.createWriteStream(filePath)
            response.data.pipe(writer)

            writer.on('finish', () => {
                res.download(filePath, 'tiktok.mp4', () => {
                    fs.unlink(filePath, () => {})
                })
            })

        } catch (e) {
            res.status(500).json({ status: false, error: 'TikTok failed' })
        }
    })
}
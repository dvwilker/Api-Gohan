const ytdl = require('ytdl-core')
const fs = require('fs')
const path = require('path')

module.exports = function(app) {
    app.get('/download/ytmp4', async (req, res) => {
        const { url } = req.query

        if (!url) {
            return res.status(400).json({
                status: false,
                error: 'URL is required'
            })
        }

        try {
            const info = await ytdl.getInfo(url)
            const title = info.videoDetails.title.replace(/[^\w\s]/gi, '')

            const fileName = `${Date.now()}_${title}.mp4`
            const filePath = path.join(__dirname, '../../../download', fileName)

            const stream = ytdl(url, {
                filter: 'audioandvideo',
                quality: 'highestvideo'
            })

            const writeStream = fs.createWriteStream(filePath)

            stream.pipe(writeStream)

            writeStream.on('finish', () => {
                res.download(filePath, `${title}.mp4`, () => {
                    fs.unlink(filePath, () => {}) // borra después
                })
            })

            writeStream.on('error', (err) => {
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
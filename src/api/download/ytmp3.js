const ytdl = require('@distube/ytdl-core')
const fs = require('fs')
const path = require('path')

module.exports = function(app) {
    app.get('/download/ytmp3', async (req, res) => {
        const { url } = req.query

        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).json({ status: false, error: 'Invalid URL' })
        }

        try {
            const info = await ytdl.getInfo(url)
            const title = info.videoDetails.title.replace(/[^\w\s]/gi, '')

            const filePath = path.join(__dirname, '../../../download', `${Date.now()}.mp3`)

            const stream = ytdl(url, {
                quality: 'highestaudio'
            })

            const write = fs.createWriteStream(filePath)
            stream.pipe(write)

            write.on('finish', () => {
                res.download(filePath, `${title}.mp3`, () => {
                    fs.unlink(filePath, () => {})
                })
            })

        } catch (e) {
            res.status(500).json({ status: false, error: e.message })
        }
    })
}
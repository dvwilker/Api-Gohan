const axios = require('axios')

module.exports = function(app) {
    app.get('/search/tiktok', async (req, res) => {
        const { query } = req.query

        if (!query) {
            return res.status(400).json({
                status: false,
                error: 'Query is required'
            })
        }

        try {
            const api = `https://tikwm.com/api/feed/search?keywords=${encodeURIComponent(query)}&count=10`
            const { data } = await axios.get(api)

            if (!data || !data.data) {
                return res.status(500).json({
                    status: false,
                    error: 'No se encontraron resultados'
                })
            }

            const results = data.data.map(video => ({
                title: video.title,
                author: video.author.nickname,
                likes: video.digg_count,
                comments: video.comment_count,
                shares: video.share_count,
                views: video.play_count,
                cover: video.cover,
                url: video.play,
                link: `https://www.tiktok.com/@${video.author.unique_id}/video/${video.video_id}`
            }))

            res.json({
                status: true,
                total: results.length,
                results
            })

        } catch (err) {
            res.status(500).json({
                status: false,
                error: err.message
            })
        }
    })
}
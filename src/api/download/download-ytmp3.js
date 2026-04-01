const axios = require("axios");
const crypto = require("crypto");

class SaveTube {
  constructor() {
    this.ky = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
    this.fmt = ['144', '240', '360', '480', '720', '1080', 'mp3'];
    this.m = /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?([a-zA-Z0-9_-]{11})/;
    this.is = axios.create({
      headers: {
        'content-type': 'application/json',
        'origin': 'https://yt.savetube.me',
        'user-agent': 'Mozilla/5.0 (Android 15; Mobile; SM-F958; rv:130.0) Gecko/130.0 Firefox/130.0'
      }
    });
  }

  async decrypt(enc) {
    try {
      const [sr, ky] = [Buffer.from(enc, 'base64'), Buffer.from(this.ky, 'hex')];
      const [iv, dt] = [sr.slice(0, 16), sr.slice(16)];
      const dc = crypto.createDecipheriv('aes-128-cbc', ky, iv);
      return JSON.parse(Buffer.concat([dc.update(dt), dc.final()]).toString());
    } catch (e) {
      throw new Error(`Error while decrypting data: ${e.message}`);
    }
  }

  async getCdn() {
    const response = await this.is.get("https://media.savetube.vip/api/random-cdn");
    if (!response.status) return response;
    return { status: true, data: response.data.cdn };
  }

  async download(url, format = 'mp3') {
    const id = url.match(this.m)?.[3];
    if (!id) return { status: false, msg: "ID cannot be extracted from url" };
    if (!format || !this.fmt.includes(format)) return { status: false, msg: "Formats not found", list: this.fmt };

    try {
      const u = await this.getCdn();
      if (!u.status) return u;

      const res = await this.is.post(`https://${u.data}/v2/info`, { url: `https://www.youtube.com/watch?v=${id}` });
      const dec = await this.decrypt(res.data.data);

      const dl = await this.is.post(`https://${u.data}/download`, {
        id: id,
        downloadType: 'audio',
        quality: '128',
        key: dec.key
      });

      return {
        status: true,
        title: dec.title,
        format: 'mp3',
        thumb: dec.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        duration: dec.duration,
        cached: dec.fromCache,
        dl: dl.data.data.downloadUrl
      };
    } catch (error) {
      return { status: false, error: error.message };
    }
  }
}

module.exports = async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ 
      status: false, 
      creator: "wilker", 
      error: "Falta ?url=" 
    });
  }

  try {
    const st = new SaveTube();
    const audio = await st.download(url, 'mp3');

    if (!audio.status) {
      return res.status(500).json(audio);
    }

    return res.json({
      status: true,
      creator: "wilker",
      data: {
        title: audio.title,
        thumbnail: audio.thumb,
        url: audio.dl
      }
    });
  } catch (e) {
    return res.status(500).json({ 
      status: false, 
      creator: "dvwilker", 
      error: e.message 
    });
  }
};
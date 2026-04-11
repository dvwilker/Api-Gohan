const axios = require('axios');

module.exports = function(app) {
    
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    async function getNewCookie() {
        try {
            const res = await axios.post(
                "https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&f.sid=-7816331052118000090&hl=en-US&_reqid=173780&rt=c",
                "f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&",
                {
                    headers: {
                        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
                        "User-Agent": UA
                    }
                }
            );

            const cookieHeader = res.headers['set-cookie'];
            if (!cookieHeader) throw new Error('No se pudo recuperar la cookie set-cookie.');

            return Array.isArray(cookieHeader) ? cookieHeader.join('; ').split(';')[0] : cookieHeader.split(';')[0];
        } catch (e) {
            throw new Error(`Error al obtener cookie: ${e.message}`);
        }
    }

    async function gemini(prompt, previousId = null) {
        if (!prompt || typeof prompt !== 'string' || !prompt.trim().length) {
            throw new Error('El prompt es requerido y debe ser un texto.');
        }

        let resumeArray = null;
        let cookie = null;

        if (previousId) {
            try {
                const s = Buffer.from(previousId, 'base64').toString('utf-8');
                const j = JSON.parse(s);
                resumeArray = j.newResumeArray;
                cookie = j.cookie;
            } catch (e) {
                console.error("Error al parsear previousId, iniciando nueva conversación.", e);
                previousId = null;
            }
        }

        if (!cookie) {
            cookie = await getNewCookie();
        }

        const headers = {
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            "x-goog-ext-525001261-jspb": "[1,null,null,null,\"9ec249fc9ad08861\",null,null,null,[4]]",
            "cookie": cookie,
            "User-Agent": UA
        };

        const b = [[prompt], ["en-US"], resumeArray];
        const a = [null, JSON.stringify(b)];
        const reqBody = new URLSearchParams({ "f.req": JSON.stringify(a) }).toString();

        try {
            const { data } = await axios.post(
                `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20250729.06_p0&f.sid=4206607810970164620&hl=en-US&_reqid=2813378&rt=c`,
                reqBody,
                { headers }
            );

            const match = data.matchAll(/^\d+\n(.+?)\n/gm);
            const chunks = Array.from(match, m => m[1]);
            let textResult = '';
            let newResumeArray = null;
            let found = false;

            for (const chunk of chunks.reverse()) {
                try {
                    const realArray = JSON.parse(chunk);
                    const parse1 = JSON.parse(realArray[0][2]);

                    if (parse1 && parse1[4] && parse1[4][0] && parse1[4][0][1] && typeof parse1[4][0][1][0] === 'string') {
                        newResumeArray = [...parse1[1], parse1[4][0][0]];
                        textResult = parse1[4][0][1][0].replace(/\*\*(.+?)\*\*/g, `*$1*`);
                        found = true;
                        break;
                    }
                } catch (e) {
                    // Ignorar errores de parseo
                }
            }

            if (!found) {
                throw new Error("No se pudo parsear la respuesta de la API de Gemini.");
            }

            const nextId = Buffer.from(JSON.stringify({ newResumeArray, cookie })).toString('base64');

            return {
                status: true,
                text: textResult,
                id: nextId
            };

        } catch (e) {
            throw new Error(`Error en Gemini API: ${e.message}`);
        }
    }

    // Endpoint principal
    app.get('/ai/gemini', async (req, res) => {
        const text = String(req.query.text || "").trim();

        if (!text) {
            return res.status(400).json({
                status: false,
                creator: "DVWILKER",
                error: 'El parámetro "text" es requerido.',
                message: 'Please provide a text: ?text=YOUR_QUESTION'
            });
        }

        try {
            const result = await gemini(text);

            if (!result || !result.text) {
                return res.status(502).json({
                    status: false,
                    creator: "DVWILKER",
                    error: "La IA no devolvió una respuesta válida.",
                    result: null
                });
            }

            // Si hay un ID de conversación (para continuar)
            const responseData = {
                status: true,
                creator: "DVWILKER",
                result: {
                    text: result.text
                }
            };

            // Si se quiere continuar la conversación, devolver el ID
            if (req.query.continue === 'true' && result.id) {
                responseData.conversation_id = result.id;
                responseData.next_url = `/ai/gemini?text=${encodeURIComponent(text)}&id=${result.id}`;
            }

            return res.status(200).json(responseData);

        } catch (err) {
            const message = String(err?.message || "");
            const statusCode =
                /prompt es requerido/i.test(message) ? 400 :
                /Error al obtener cookie/i.test(message) ? 503 :
                /No se pudo parsear/i.test(message) ? 502 :
                /timeout|ETIMEDOUT|ECONNABORTED/i.test(message) ? 504 :
                500;

            return res.status(statusCode).json({
                status: false,
                creator: "DVWILKER",
                error: message && statusCode !== 500 ? message : "Ocurrió un error interno en el servidor."
            });
        }
    });

    // Endpoint para continuar conversación
    app.get('/ai/gemini/continue', async (req, res) => {
        const { text, id } = req.query;

        if (!text) {
            return res.status(400).json({
                status: false,
                creator: "DVWILKER",
                error: 'El parámetro "text" es requerido.'
            });
        }

        if (!id) {
            return res.status(400).json({
                status: false,
                creator: "DVWILKER",
                error: 'El parámetro "id" es requerido para continuar la conversación.'
            });
        }

        try {
            const result = await gemini(text, id);

            if (!result || !result.text) {
                return res.status(502).json({
                    status: false,
                    creator: "DVWILKER",
                    error: "La IA no devolvió una respuesta válida."
                });
            }

            return res.status(200).json({
                status: true,
                creator: "DVWILKER",
                result: {
                    text: result.text
                },
                conversation_id: result.id,
                next_url: `/ai/gemini/continue?text=${encodeURIComponent(text)}&id=${result.id}`
            });

        } catch (err) {
            return res.status(500).json({
                status: false,
                creator: "DVWILKER",
                error: err.message
            });
        }
    });
};
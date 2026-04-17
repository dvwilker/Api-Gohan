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

    async function dvwilkAI(prompt, previousId = null) {
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

        const b = [[prompt], ["es-ES"], resumeArray];
        const a = [null, JSON.stringify(b)];
        const reqBody = new URLSearchParams({ "f.req": JSON.stringify(a) }).toString();

        try {
            const { data } = await axios.post(
                `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20250729.06_p0&f.sid=4206607810970164620&hl=es-ES&_reqid=2813378&rt=c`,
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
                throw new Error("No se pudo parsear la respuesta de la API.");
            }

            const nextId = Buffer.from(JSON.stringify({ newResumeArray, cookie })).toString('base64');

            return {
                status: true,
                text: textResult,
                id: nextId
            };

        } catch (e) {
            throw new Error(`Error en DvWilk AI: ${e.message}`);
        }
    }

    // Endpoint principal de DvWilk AI
    app.get('/ai/dvwilker', async (req, res) => {
        const { text, prompt, q, message, ask } = req.query;
        const question = text || prompt || q || message || ask;
        const endpointPrefix = req.baseUrl || '';
        
        if (!question) {
            return res.status(400).json({
                status: false,
                creator: "DVWILKER",
                error: 'El parámetro "text", "prompt" o "q" es requerido.',
                usage: {
                    example: `${endpointPrefix}/ai/dvwilker?text=Hola, ¿cómo estás?`,
                    params: {
                        text: "Tu pregunta o mensaje para la IA",
                        continue: "true (opcional) - Para continuar conversación",
                        id: "ID de conversación (opcional)"
                    }
                }
            });
        }

        try {
            // Si hay un ID de conversación, usarlo
            const conversationId = req.query.id || null;
            const result = await dvwilkAI(question, conversationId);

            if (!result || !result.text) {
                return res.status(502).json({
                    status: false,
                    creator: "DVWILKER",
                    error: "DvWilk AI no devolvió una respuesta válida."
                });
            }

            const responseData = {
                status: true,
                creator: "DVWILKER",
                ai: "DvWilk AI",
                version: "1.0.0",
                question: question,
                response: result.text,
                conversation_id: result.id,
                timestamp: new Date().toISOString()
            };

            // Si se solicita continuar la conversación
            if (req.query.continue === 'true') {
                responseData.next_url = `${endpointPrefix}/ai/dvwilker?text=${encodeURIComponent(question)}&id=${result.id}`;
            }

            return res.status(200).json(responseData);

        } catch (err) {
            console.error('DvWilk AI Error:', err);
            return res.status(500).json({
                status: false,
                creator: "DVWILKER",
                ai: "DvWilk AI",
                error: err.message || "Ocurrió un error interno en el servidor."
            });
        }
    });

    // Endpoint para continuar conversación
    app.get('/ai/dvwilker/continue', async (req, res) => {
        const { text, id } = req.query;
        const endpointPrefix = req.baseUrl || '';

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
            const result = await dvwilkAI(text, id);

            if (!result || !result.text) {
                return res.status(502).json({
                    status: false,
                    creator: "DVWILKER",
                    error: "DvWilk AI no devolvió una respuesta válida."
                });
            }

            return res.status(200).json({
                status: true,
                creator: "DVWILKER",
                ai: "DvWilk AI",
                response: result.text,
                conversation_id: result.id,
                next_url: `${endpointPrefix}/ai/dvwilker/continue?text=${encodeURIComponent(text)}&id=${result.id}`
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

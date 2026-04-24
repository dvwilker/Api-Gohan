const express = require('express')
const chalk = require('chalk')
const fs = require('fs')
const cors = require('cors')
const path = require('path')
const os = require('os')
const si = require('systeminformation')
const axios = require('axios')
const { createClient } = require('@supabase/supabase-js')

const app = express()
const PORT = process.env.PORT || 10005

// ============ SUPABASE CONFIGURACIÓN ============
const supabaseUrl = 'https://gcuvinttyjiahpzpfer.supabase.co'
const supabaseAnonKey = 'sb_publishable_RheK_MsEe-YffOuR9XMmjQ_Mpcutq1o'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

app.enable("trust proxy")
app.set("json spaces", 2)
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cors())
app.use('/', express.static(path.join(__dirname, 'api-page')))
app.use('/src', express.static(path.join(__dirname, 'src')))

const settingsPath = path.join(__dirname, './src/settings.json')
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))

let requestCount = 0
const apiStartTime = Date.now()
const userRequests = {}

app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown'
    const currentDate = new Date().toISOString().split('T')[0]
    if (!userRequests[ip]) userRequests[ip] = {}
    if (userRequests[ip].date !== currentDate) {
        userRequests[ip].date = currentDate
        userRequests[ip].count = 0
    }
    if (userRequests[ip].count >= parseInt(settings.apiSettings.limit)) {
        return res.status(429).json({
            status: 429,
            message: "Daily request limit reached",
            creator: settings.apiSettings.creator
        })
    }
    userRequests[ip].count++
    requestCount++
    next()
})

app.use((req, res, next) => {
    const originalJson = res.json
    res.json = function (data) {
        if (data && typeof data === 'object') {
            const responseData = {
                status: data.status,
                creator: settings.apiSettings.creator || "DV WILKER",
                ...data
            }
            return originalJson.call(this, responseData)
        }
        return originalJson.call(this, data)
    }
    next()
})

// ============ ENDPOINTS DE AUTENTICACIÓN ============

// REGISTRO
app.post('/api/register', async (req, res) => {
    const { fullName, email, password } = req.body
    
    if (!fullName || !email || !password) {
        return res.status(400).json({ status: 400, message: "Faltan campos" })
    }
    
    const { data: existing } = await supabase
        .from('usuarios')
        .select('email')
        .eq('email', email)
        .single()
    
    if (existing) {
        return res.status(400).json({ status: 400, message: "Email ya registrado" })
    }
    
    const newUser = {
        id: Date.now(),
        fullName: fullName,
        email: email,
        password: password,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
        createdAt: new Date().toISOString()
    }
    
    const { data, error } = await supabase
        .from('usuarios')
        .insert([newUser])
        .select()
    
    if (error) {
        return res.status(500).json({ status: 500, message: error.message })
    }
    
    res.json({
        status: 200,
        message: "Usuario registrado exitosamente",
        user: data[0]
    })
})

// LOGIN
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body
    
    if (!email || !password) {
        return res.status(400).json({ status: 400, message: "Faltan campos" })
    }
    
    const { data: user, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single()
    
    if (error || !user) {
        return res.status(401).json({ status: 401, message: "Correo o contraseña incorrectos" })
    }
    
    res.json({
        status: 200,
        message: "Login exitoso",
        user: user
    })
})

// OBTENER PERFIL
app.get('/api/profile/:id', async (req, res) => {
    const { id } = req.params
    
    const { data: user, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .single()
    
    if (error || !user) {
        return res.status(404).json({ status: 404, message: "Usuario no encontrado" })
    }
    
    res.json({
        status: 200,
        user: user
    })
})

// ACTUALIZAR PERFIL
app.put('/api/profile/:id', async (req, res) => {
    const { id } = req.params
    const { fullName, password, avatar } = req.body
    
    const updates = {}
    if (fullName) updates.fullName = fullName
    if (password) updates.password = password
    if (avatar) updates.avatar = avatar
    
    const { data, error } = await supabase
        .from('usuarios')
        .update(updates)
        .eq('id', id)
        .select()
    
    if (error) {
        return res.status(500).json({ status: 500, message: error.message })
    }
    
    res.json({
        status: 200,
        message: "Perfil actualizado",
        user: data[0]
    })
})

// ============ CARGAR RUTAS DE LA API ============
let totalRoutes = 0
const apiFolder = path.join(__dirname, './src/api')
if (fs.existsSync(apiFolder)) {
    fs.readdirSync(apiFolder).forEach((subfolder) => {
        const subfolderPath = path.join(apiFolder, subfolder)
        if (fs.statSync(subfolderPath).isDirectory()) {
            fs.readdirSync(subfolderPath).forEach((file) => {
                const filePath = path.join(subfolderPath, file)
                if (path.extname(file) === '.js') {
                    require(filePath)(app)
                    totalRoutes++
                    console.log(chalk.bgHex('#FFFF99').hex('#333').bold(` Loaded Route: ${path.basename(file)} `))
                }
            })
        }
    })
}

console.log(chalk.bgHex('#90EE90').hex('#333').bold(' Load Complete! ✓ '))
console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Total Routes Loaded: ${totalRoutes} `))

// ============ ENDPOINT STATUS (sin cambios) ============
app.get('/status', async (req, res) => {
    const start = Date.now()
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown'
    const uptime = ((Date.now() - apiStartTime) / 1000).toFixed(0)

    let geo = {}
    try {
        const geoRes = await axios.get(`https://ipapi.co/${ip}/json/`)
        geo = geoRes.data
    } catch (err) {
        geo = { error: true, message: "Geo lookup failed" }
    }

    const mem = await si.mem()
    const cpu = await si.cpu()
    const cpuSpeed = await si.cpuCurrentSpeed()
    const cpuTemp = await si.cpuTemperature()
    const disk = await si.fsSize()
    const osInfo = await si.osInfo()
    const net = await si.networkInterfaces()
    const processes = await si.processes()
    const latency = Date.now() - start

    res.json({
        creator: settings.apiSettings.creator,
        uptime_seconds: uptime,
        total_requests: requestCount,
        routes_loaded: totalRoutes,
        daily_limit: settings.apiSettings.limit,
        active_users: Object.keys(userRequests).length,
        current_date: new Date().toISOString(),
        api_latency_ms: latency,
        user: {
            ip: ip,
            geo: {
                country: geo.country_name || 'Unknown',
                region: geo.region || 'Unknown',
                city: geo.city || 'Unknown',
                timezone: geo.timezone || 'Unknown',
                latitude: geo.latitude || null,
                longitude: geo.longitude || null,
                isp: geo.org || 'Unknown'
            }
        },
        system: {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            os_distro: osInfo.distro,
            release: osInfo.release,
            uptime_os_seconds: os.uptime(),
            cpu_model: cpu.brand,
            cores: cpu.cores,
            cpu_speed_ghz: cpuSpeed.avg,
            cpu_temperature_celsius: cpuTemp.main || 'N/A',
            ram_total_gb: (mem.total / 1e9).toFixed(2),
            ram_used_gb: ((mem.total - mem.available) / 1e9).toFixed(2),
            ram_free_gb: (mem.available / 1e9).toFixed(2),
            disk_total_gb: (disk[0]?.size / 1e9).toFixed(2),
            disk_used_gb: (disk[0]?.used / 1e9).toFixed(2),
            disk_free_gb: (disk[0]?.available / 1e9).toFixed(2),
            cpu_load_percent: cpuSpeed.avg ? cpuSpeed.avg * 10 : 'Unknown',
            running_processes: processes.all,
            network_interfaces: net.map(n => ({
                iface: n.iface,
                ip4: n.ip4,
                mac: n.mac,
                speed: n.speed
            }))
        }
    })
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'api-page', 'index.html'))
})

app.use((req, res, next) => {
    res.status(404).sendFile(process.cwd() + "/api-page/404.html")
})

app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).sendFile(process.cwd() + "/api-page/500.html")
})

app.listen(PORT, () => {
    console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Server is running on port ${PORT} `))
})

module.exports = app
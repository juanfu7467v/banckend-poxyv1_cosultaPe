import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

// Carga las variables de entorno desde .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Variables de configuración de la API externa
const TOKEN_LEDER = process.env.TOKEN_LEDER;

// Variables de configuración de GitHub para el guardado de resultados
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
// GITHUB_REPO debe estar en formato "dueño/repositorio", e.g., "miusuario/mis-datos"
const GITHUB_REPO = process.env.GITHUB_REPO; 
const GITHUB_API_URL = "https://api.github.com";
const PUBLIC_DIR = "public"; // La ruta donde se guardarán los archivos JSON

// Mapa para asociar la ruta de Express con el nombre del archivo JSON
const FILENAME_MAP = {
    "/reniec": "dni.json",
    "/denuncias-dni": "denuncias_dni.json",
    "/sueldos": "sueldos.json",
    "/trabajos": "trabajos.json",
    "/sunat": "sunat_ruc.json",
    "/sunat-razon": "sunat_razon.json",
    "/consumos": "consumos.json",
    "/arbol": "arbol.json",
    "/familia1": "familia1.json",
    "/familia2": "familia2.json",
    "/familia3": "familia3.json",
    "/movimientos": "movimientos.json",
    "/matrimonios": "matrimonios.json",
    "/empresas": "empresas.json",
    "/direcciones": "direcciones.json",
    "/correos": "correos.json",
    "/telefonia-doc": "telefonia_documento.json",
    "/telefonia-num": "telefonia_numero.json",
    "/vehiculos": "vehiculos.json",
    "/fiscalia-dni": "fiscalia_dni.json",
    "/fiscalia-nombres": "fiscalia_nombres.json",
    "/denuncias-placa": "denuncias_placa.json",
};

app.use(cors());
app.use(express.json());

/* ============================
   Funciones auxiliares de GitHub
============================ */

/**
 * Guarda el resultado de la consulta en un archivo JSON en GitHub.
 *
 * @param {string} filename El nombre del archivo JSON (e.g., 'dni.json').
 * @param {object} newData El objeto de resultado a guardar.
 * @param {string} apiPath La ruta de la API consultada (para el mensaje de commit).
 * @param {object} queryParams Los parámetros de la consulta original.
 */
const saveResultToGithub = async (filename, newData, apiPath, queryParams) => {
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
        console.error("⚠️ Variables GITHUB_TOKEN o GITHUB_REPO no configuradas. Saltando guardado en GitHub.");
        return;
    }

    const filePath = `${PUBLIC_DIR}/${filename}`;
    const url = `${GITHUB_API_URL}/repos/${GITHUB_REPO}/contents/${filePath}`;
    const commitMessage = `💾 Guardado automático de consulta ${apiPath}`;
    
    // Objeto que se añadirá al array JSON del archivo
    const entryToSave = {
        timestamp: new Date().toISOString(),
        queryParams: queryParams,
        result: newData,
    };

    let existingContent = [];
    let sha = null;
    let currentBranch = 'main'; // Asumimos 'main' como la rama por defecto

    try {
        // 1. Intentar obtener el contenido actual del archivo (para obtener el SHA)
        const getResponse = await axios.get(url, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` },
        });

        sha = getResponse.data.sha;
        const contentBase64 = getResponse.data.content.replace(/\n/g, "");
        const contentJsonString = Buffer.from(contentBase64, 'base64').toString('utf8');
        
        // El contenido siempre debe ser un array
        existingContent = JSON.parse(contentJsonString);
        if (!Array.isArray(existingContent)) {
            existingContent = [];
            console.warn(`⚠️ El archivo ${filename} existe, pero no es un array JSON. Se reinicia.`);
        }

    } catch (error) {
        // Si el archivo no existe (error 404), 'sha' se mantiene en null y 'existingContent' es []
        if (error.response && error.response.status === 404) {
            console.log(`✨ Creando archivo nuevo: ${filePath}`);
        } else {
            console.error(`⚠️ Error al leer el archivo ${filePath} de GitHub:`, error.message);
            // No continuar si hubo un error al leer y no fue 404
            return; 
        }
    }

    // 2. Agregar el nuevo resultado
    existingContent.push(entryToSave);
    const newContentJsonString = JSON.stringify(existingContent, null, 2);
    const newContentBase64 = Buffer.from(newContentJsonString).toString('base64');
    
    // 3. Crear el payload para el PUT (commit)
    const commitPayload = {
        message: commitMessage,
        content: newContentBase64,
        sha: sha, // Se incluye solo si estamos actualizando un archivo existente
        branch: currentBranch,
    };

    try {
        console.log(`⏳ Subiendo commit para ${filePath}...`);
        
        // 4. Subir el nuevo contenido (PUT)
        await axios.put(url, commitPayload, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` },
        });

        console.log(`✅ Guardado en GitHub exitoso: ${filePath}`);
    } catch (error) {
        console.error(`❌ Error al subir el commit a GitHub para ${filePath}:`, error.response?.data?.message || error.message);
    }
};


/** Consulta a Leder Data (GET → POST) */
const postToLederData = async (req, res, lederDataPath, payload) => {
  try {
    const url = `https://leder-data-api.ngrok.dev/v1.7${lederDataPath}`;
    console.log(`🔗 LederData: ${req.path}`);

    // Añade el token de Leder al payload
    const postPayload = {
        ...payload,
        token: TOKEN_LEDER,
    };

    const response = await axios.post(url, postPayload);

    const resultData = response.data;
    
    // Clonamos el payload y eliminamos el token para los logs/guardado
    const queryParams = { ...payload };
    delete queryParams.token;
    
    // --- PASO CLAVE: Guardado asíncrono en GitHub ---
    
    // 1. Obtener el nombre de archivo a partir de la ruta
    const filename = FILENAME_MAP[req.path];

    if (filename) {
        // 2. Llamar a la función de guardado en GitHub de forma asíncrona
        saveResultToGithub(filename, resultData, req.path, queryParams);
    } else {
        console.warn(`⚠️ Ruta ${req.path} no mapeada para guardado en archivo.`);
    }

    // -----------------------------------------------------------

    // Devolver la respuesta al cliente
    return res.status(200).json(resultData);
  } catch (err) {
    console.error("❌ LederData error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      message: "Error Leder Data",
      detalle: err.response?.data || err.message,
    });
  }
};


/* ============================
   Endpoints LederData
============================ */
// Nota: Se pasa 'req' a postToLederData para obtener la ruta y el nombre del archivo
app.get("/reniec", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/reniec", {
    dni: req.query.dni,
    source: req.query.source || "database",
  });
});

app.get("/denuncias-dni", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/denuncias-policiales-dni", { dni: req.query.dni });
});

app.get("/denuncias-placa", (req, res) => {
  if (!req.query.placa)
    return res.status(400).json({ success: false, message: "placa requerida" });
  postToLederData(req, res, "/persona/denuncias-policiales-placa", { placa: req.query.placa });
});

app.get("/sueldos", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/sueldos", { dni: req.query.dni });
});

app.get("/trabajos", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/trabajos", { dni: req.query.dni });
});

app.get("/sunat", (req, res) => {
  if (!req.query.data) // 'data' puede ser RUC o razón social
    return res.status(400).json({ success: false, message: "data (ruc o razón social) requerida" });
  postToLederData(req, res, "/empresa/sunat", { data: req.query.data });
});

app.get("/sunat-razon", (req, res) => {
  if (!req.query.data) // 'data' es razón social
    return res.status(400).json({ success: false, message: "data (razón social) requerida" });
  postToLederData(req, res, "/empresa/sunat/razon-social", { data: req.query.data });
});

app.get("/consumos", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/consumos", { dni: req.query.dni });
});

app.get("/arbol", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/arbol-genealogico", { dni: req.query.dni });
});

app.get("/familia1", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/familia-1", { dni: req.query.dni });
});

app.get("/familia2", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/familia-2", { dni: req.query.dni });
});

app.get("/familia3", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/familia-3", { dni: req.query.dni });
});

app.get("/movimientos", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/movimientos-migratorios", { dni: req.query.dni });
});

app.get("/matrimonios", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/matrimonios", { dni: req.query.dni });
});

app.get("/empresas", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/empresas", { dni: req.query.dni });
});

app.get("/direcciones", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/direcciones", { dni: req.query.dni });
});

app.get("/correos", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/correos", { dni: req.query.dni });
});

app.get("/telefonia-doc", (req, res) => {
  if (!req.query.documento)
    return res.status(400).json({ success: false, message: "documento requerido" });
  postToLederData(req, res, "/telefonia/documento", { documento: req.query.documento });
});

app.get("/telefonia-num", (req, res) => {
  if (!req.query.numero)
    return res.status(400).json({ success: false, message: "numero requerido" });
  postToLederData(req, res, "/telefonia/numero", { numero: req.query.numero });
});

app.get("/vehiculos", (req, res) => {
  if (!req.query.placa)
    return res.status(400).json({ success: false, message: "placa requerida" });
  postToLederData(req, res, "/vehiculos/sunarp", { placa: req.query.placa });
});

app.get("/fiscalia-dni", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  postToLederData(req, res, "/persona/justicia/fiscalia/dni", { dni: req.query.dni });
});

app.get("/fiscalia-nombres", (req, res) => {
  if (!req.query.nombres || !req.query.apepaterno || !req.query.apematerno)
    return res.status(400).json({ success: false, message: "nombres, apepaterno y apematerno requeridos" });
  postToLederData(req, res, "/persona/justicia/fiscalia/nombres", {
    nombres: req.query.nombres,
    apepaterno: req.query.apepaterno,
    apematerno: req.query.apematerno,
  });
});

/* ============================
   Default
============================ */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🚀 API Consulta PE lista con LederData y Guardado Automático en GitHub Activado",
  });
});

/* ============================
   Servidor
============================ */
app.listen(PORT, () => {
  console.log(`✅ API corriendo en puerto ${PORT}`);
  console.log(`Guardado configurado para repositorio: ${GITHUB_REPO}`);
});

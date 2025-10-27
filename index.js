import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN_FACTILIZA = process.env.TOKEN_FACTILIZA;
const TOKEN_LEDER = process.env.TOKEN_LEDER;

// URL de la base de datos de log (tu nueva API)
const DATABASE_LOG_API = "https://base-datos-consulta-pe.fly.dev";

app.use(cors());
app.use(express.json());

/* ============================
   Funciones auxiliares
============================ */

/**
 * Guarda el resultado exitoso de la consulta en la base de datos de logs (asíncrono).
 * Esta función NO bloquea el flujo de la respuesta principal.
 */
const logSuccessfulQuery = async (endpoint, queryParams, resultData) => {
  // Usamos una ruta genérica para loguear todas las consultas
  const url = `${DATABASE_LOG_API}/guardar_consulta`;
  
  try {
    console.log(`⏳ Intentando guardar log para ${endpoint}...`);
    // Usamos axios para la llamada POST
    await axios.post(url, {
      endpoint: endpoint,     // Ruta de Express (e.g., /dni, /reniec)
      queryParams: queryParams, // Parámetros originales de la consulta
      resultado: resultData,    // El resultado exitoso de la API externa
    }, {
      headers: { "Content-Type": "application/json" }
    });
    console.log(`✅ Log exitoso para ${endpoint}`);
  } catch (err) {
    // Captura el error de logueo. Es crucial que el error de log NO interrumpa 
    // el envío de la respuesta al cliente.
    console.error(`⚠️ Error al guardar log en la BD para ${endpoint}:`, err.message);
  }
};


/** Consulta a Factiliza (GET directo) */
// Se modificó para recibir 'req' y 'factilizaPath'
const getFromFactiliza = async (req, res, factilizaPath) => {
  try {
    const url = `https://api.factiliza.com/v1${factilizaPath}`;
    console.log("🔗 Factiliza:", url);

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${TOKEN_FACTILIZA}`,
        "Content-Type": "application/json",
      },
    });

    // --- PASO CLAVE: Logueo asíncrono del resultado exitoso ---
    logSuccessfulQuery(req.path, req.query, response.data);
    // -----------------------------------------------------------

    return res.status(200).json(response.data);
  } catch (err) {
    console.error("❌ Factiliza error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      message: "Error Factiliza",
      detalle: err.response?.data || err.message,
    });
  }
};

/** Consulta a Leder Data (GET → POST) */
// Se modificó para recibir 'req', 'lederDataPath' y 'payload'
const postToLederData = async (req, res, lederDataPath, payload) => {
  try {
    const url = `https://leder-data-api.ngrok.dev/v1.7${lederDataPath}`;
    console.log("🔗 LederData:", url, payload);

    const response = await axios.post(url, {
      ...payload,
      token: TOKEN_LEDER,
    });

    // --- PASO CLAVE: Logueo asíncrono del resultado exitoso ---
    // Clonamos el payload y eliminamos el token antes de loguear los parámetros
    const queryParams = { ...payload };
    delete queryParams.token;
    
    logSuccessfulQuery(req.path, queryParams, response.data);
    // -----------------------------------------------------------

    return res.status(200).json(response.data);
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
   Endpoints Factiliza (7 básicos)
   (Actualizados para pasar 'req' a getFromFactiliza)
============================ */
app.get("/dni", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  getFromFactiliza(req, res, `/dni/info/${req.query.dni}`);
});

app.get("/ruc", (req, res) => {
  if (!req.query.ruc)
    return res.status(400).json({ success: false, message: "ruc requerido" });
  getFromFactiliza(req, res, `/ruc/info/${req.query.ruc}`);
});

app.get("/ruc-anexo", (req, res) => {
  if (!req.query.ruc)
    return res.status(400).json({ success: false, message: "ruc requerido" });
  getFromFactiliza(req, res, `/ruc/anexo/${req.query.ruc}`);
});

app.get("/ruc-representante", (req, res) => {
  if (!req.query.ruc)
    return res.status(400).json({ success: false, message: "ruc requerido" });
  getFromFactiliza(req, res, `/ruc/representante/${req.query.ruc}`);
});

app.get("/cee", (req, res) => {
  if (!req.query.cee)
    return res.status(400).json({ success: false, message: "cee requerido" });
  getFromFactiliza(req, res, `/cee/info/${req.query.cee}`);
});

app.get("/placa", (req, res) => {
  if (!req.query.placa)
    return res.status(400).json({ success: false, message: "placa requerida" });
  getFromFactiliza(req, res, `/placa/soat/${req.query.placa}`);
});

app.get("/licencia", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  getFromFactiliza(req, res, `/licencia/info/${req.query.dni}`);
});

/* ============================
   Endpoints LederData (23 avanzados)
   (Actualizados para pasar 'req' a postToLederData)
============================ */
app.get("/reniec", (req, res) => {
  postToLederData(req, res, "/persona/reniec", {
    dni: req.query.dni,
    source: req.query.source || "database",
  });
});

app.get("/denuncias-dni", (req, res) => {
  postToLederData(req, res, "/persona/denuncias-policiales-dni", { dni: req.query.dni });
});

app.get("/denuncias-placa", (req, res) => {
  postToLederData(req, res, "/persona/denuncias-policiales-placa", { placa: req.query.placa });
});

app.get("/sueldos", (req, res) => {
  postToLederData(req, res, "/persona/sueldos", { dni: req.query.dni });
});

app.get("/trabajos", (req, res) => {
  postToLederData(req, res, "/persona/trabajos", { dni: req.query.dni });
});

app.get("/sunat", (req, res) => {
  postToLederData(req, res, "/empresa/sunat", { data: req.query.data });
});

app.get("/sunat-razon", (req, res) => {
  postToLederData(req, res, "/empresa/sunat/razon-social", { data: req.query.data });
});

app.get("/consumos", (req, res) => {
  postToLederData(req, res, "/persona/consumos", { dni: req.query.dni });
});

app.get("/arbol", (req, res) => {
  postToLederData(req, res, "/persona/arbol-genealogico", { dni: req.query.dni });
});

app.get("/familia1", (req, res) => {
  postToLederData(req, res, "/persona/familia-1", { dni: req.query.dni });
});

app.get("/familia2", (req, res) => {
  postToLederData(req, res, "/persona/familia-2", { dni: req.query.dni });
});

app.get("/familia3", (req, res) => {
  postToLederData(req, res, "/persona/familia-3", { dni: req.query.dni });
});

app.get("/movimientos", (req, res) => {
  postToLederData(req, res, "/persona/movimientos-migratorios", { dni: req.query.dni });
});

app.get("/matrimonios", (req, res) => {
  postToLederData(req, res, "/persona/matrimonios", { dni: req.query.dni });
});

app.get("/empresas", (req, res) => {
  postToLederData(req, res, "/persona/empresas", { dni: req.query.dni });
});

app.get("/direcciones", (req, res) => {
  postToLederData(req, res, "/persona/direcciones", { dni: req.query.dni });
});

app.get("/correos", (req, res) => {
  postToLederData(req, res, "/persona/correos", { dni: req.query.dni });
});

app.get("/telefonia-doc", (req, res) => {
  postToLederData(req, res, "/telefonia/documento", { documento: req.query.documento });
});

app.get("/telefonia-num", (req, res) => {
  postToLederData(req, res, "/telefonia/numero", { numero: req.query.numero });
});

app.get("/vehiculos", (req, res) => {
  postToLederData(req, res, "/vehiculos/sunarp", { placa: req.query.placa });
});

app.get("/fiscalia-dni", (req, res) => {
  postToLederData(req, res, "/persona/justicia/fiscalia/dni", { dni: req.query.dni });
});

app.get("/fiscalia-nombres", (req, res) => {
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
    message: "🚀 API Consulta PE lista con Factiliza + LederData (30 endpoints) y Logueo Activado",
  });
});

/* ============================
   Servidor
============================ */
app.listen(PORT, () => {
  console.log(`✅ API corriendo en puerto ${PORT}`);
});


import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN_LEDER = process.env.TOKEN_LEDER;

// URL de la base de datos de log/guardado
const DATABASE_LOG_API = "https://base-datos-consulta-pe.fly.dev";

app.use(cors());
app.use(express.json());

/* ============================
   Funciones auxiliares
============================ */

/**
 * Guarda el resultado exitoso de la consulta en la base de datos de logs (asíncrono).
 * Esta función NO bloquea el flujo de la respuesta principal.
 * Se mantiene la función original de LOG (POST) para registrar el evento de consulta.
 */
const logSuccessfulQuery = async (endpoint, queryParams, resultData) => {
  // Usamos una ruta genérica para loguear todas las consultas
  const url = `${DATABASE_LOG_API}/guardar_consulta`;
  
  try {
    // console.log(`⏳ Intentando guardar log para ${endpoint}...`);
    // Usamos axios para la llamada POST
    await axios.post(url, {
      endpoint: endpoint,     // Ruta de Express (e.g., /reniec)
      queryParams: queryParams, // Parámetros originales de la consulta
      resultado: resultData,    // El resultado exitoso de la API externa
    }, {
      headers: { "Content-Type": "application/json" }
    });
    // console.log(`✅ Log exitoso para ${endpoint}`);
  } catch (err) {
    // Captura el error de logueo. Es crucial que el error de log NO interrumpa 
    // el envío de la respuesta al cliente.
    console.error(`⚠️ Error al guardar log en la BD para ${endpoint}:`, err.message);
  }
};


/** * Guarda cualquier dato en la API dinámica /guardar/:tipo usando el método GET.
 * La data debe ser un objeto JSON (key: value) que se convierte a query string.
 * **Esta es la función actualizada que reemplaza al POST anterior.**
 */
const saveDynamicData = async (dataType, data) => {
  // Construye la URL base: https://base-datos-consulta-pe.fly.dev/guardar/<tipo>
  let url = `${DATABASE_LOG_API}/guardar/${dataType}`;
  
  // 1. Convierte el objeto de datos a un array de pares [clave, valor]
  const params = Object.entries(data);
  
  // 2. Si hay datos, construye la query string
  if (params.length > 0) {
    // Mapea cada par a 'clave=valor' y une con '&'
    const queryString = params
      .map(([key, value]) => {
        // Codifica la clave y el valor para que sea seguro en la URL
        const encodedKey = encodeURIComponent(key);
        // Convierte el valor a cadena y lo codifica
        const encodedValue = encodeURIComponent(String(value)); 
        return `${encodedKey}=${encodedValue}`;
      })
      .join('&');

    // Agrega el separador '?' y la query string a la URL
    url += `?${queryString}`;
  }

  try {
    console.log(`💾 Intentando guardar data dinámica de tipo '${dataType}' con GET...`);
    // Usamos axios para la llamada GET
    await axios.get(url);
    console.log(`✅ Guardado dinámico exitoso para tipo: ${dataType}`);
  } catch (err) {
    // Captura el error de guardado. NO interrumpe la respuesta al cliente.
    console.error(`⚠️ Error al guardar data dinámica para ${dataType}:`, err.response?.data || err.message);
  }
};


/** Consulta a Leder Data (GET → POST) */
const postToLederData = async (req, res, lederDataPath, payload) => {
  try {
    const url = `https://leder-data-api.ngrok.dev/v1.7${lederDataPath}`;
    console.log("🔗 LederData:", url, payload);

    const response = await axios.post(url, {
      ...payload,
      token: TOKEN_LEDER,
    });

    const resultData = response.data;

    // --- PASO CLAVE 1: Logueo asíncrono del resultado exitoso (POST) ---
    // Clonamos el payload y eliminamos el token antes de loguear los parámetros
    const queryParams = { ...payload };
    delete queryParams.token;
    
    logSuccessfulQuery(req.path, queryParams, resultData);
    
    // --- PASO CLAVE 2: Guardado dinámico asíncrono del resultado exitoso (GET) ---
    
    // Se define el tipo de data a guardar basado en la ruta (endpoint)
    let dataType;
    switch (req.path) {
        case "/reniec":
            dataType = "dni";
            break;
        case "/denuncias-dni":
        case "/sueldos":
        case "/trabajos":
        case "/consumos":
        case "/arbol":
        case "/familia1":
        case "/familia2":
        case "/familia3":
        case "/movimientos":
        case "/matrimonios":
        case "/empresas":
        case "/direcciones":
        case "/correos":
        case "/fiscalia-dni":
            dataType = "persona"; // Tipo genérico para datos de DNI
            break;
        case "/sunat":
        case "/sunat-razon":
            dataType = "ruc";
            break;
        case "/vehiculos":
            dataType = "placa";
            break;
        case "/telefonia-doc":
            dataType = "telefono_documento";
            break;
        case "/telefonia-num":
            dataType = "telefono_numero";
            break;
        case "/denuncias-placa":
            dataType = "denuncias_placa";
            break;
        case "/fiscalia-nombres":
            dataType = "fiscalia_nombres";
            break;
        default:
            dataType = "otro"; // Tipo por defecto
    }

    // Llamamos a la función de guardado con el tipo y la data
    // Nota: Si el resultado de la API es un array, es mejor pasar un objeto para el guardado
    // Por simplicidad y consistencia, asumimos que 'resultData' es un objeto o contiene las claves necesarias.
    // Si 'resultData' no es un objeto, podría ser necesario modificarlo aquí.
    if (typeof resultData === 'object' && resultData !== null && !Array.isArray(resultData)) {
      saveDynamicData(dataType, resultData);
    } else if (Array.isArray(resultData) && resultData.length > 0 && typeof resultData[0] === 'object') {
      // Si es un array de objetos, guardamos solo el primer elemento por simplicidad.
      // Se recomienda ajustar esta lógica si se necesita guardar todo el array.
      saveDynamicData(dataType, resultData[0]);
    } else {
      // Si el resultado es una estructura no esperada para el guardado (e.g., solo un string o número)
      console.log(`⚠️ Resultado no apto para guardado dinámico de tipo ${dataType}:`, typeof resultData);
    }
    // -----------------------------------------------------------

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
   Endpoints Factiliza (7 básicos)
   (ELIMINADOS)
============================ */


/* ============================
   Endpoints LederData (23 avanzados)
   (Actualizados para pasar 'req' a postToLederData)
============================ */
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
    message: "🚀 API Consulta PE lista solo con LederData (23 endpoints), Logueo (POST) y Guardado Dinámico (GET) Activado",
  });
});

/* ============================
   Servidor
============================ */
app.listen(PORT, () => {
  console.log(`✅ API corriendo en puerto ${PORT}`);
});

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const TOKEN = process.env.TOKEN;

app.use(cors());
app.use(express.json());

/* ============================
   Funciones auxiliares
============================ */

/**
 * Consulta a Factiliza
 */
const getFromFactiliza = async (endpointPath, res) => {
  try {
    const url = `https://api.factiliza.com/v1${endpointPath}`;
    console.log("🔗 Factiliza:", url);

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    });

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

/**
 * Consulta a Leder Data (siempre POST)
 */
const postToLederData = async (endpointPath, payload, res) => {
  try {
    const url = `https://leder-data-api.ngrok.dev/v1.7${endpointPath}`;
    console.log("🔗 LederData:", url, payload);

    const response = await axios.post(url, { ...payload, token: TOKEN });

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
   Factiliza Endpoints (GET)
============================ */
app.get("/dni", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  getFromFactiliza(`/dni/info/${req.query.dni}`, res);
});

app.get("/ruc", (req, res) => {
  if (!req.query.ruc)
    return res.status(400).json({ success: false, message: "ruc requerido" });
  getFromFactiliza(`/ruc/info/${req.query.ruc}`, res);
});

app.get("/ruc-anexo", (req, res) => {
  if (!req.query.ruc)
    return res.status(400).json({ success: false, message: "ruc requerido" });
  getFromFactiliza(`/ruc/anexo/${req.query.ruc}`, res);
});

app.get("/ruc-representante", (req, res) => {
  if (!req.query.ruc)
    return res.status(400).json({ success: false, message: "ruc requerido" });
  getFromFactiliza(`/ruc/representante/${req.query.ruc}`, res);
});

app.get("/cee", (req, res) => {
  if (!req.query.cee)
    return res.status(400).json({ success: false, message: "cee requerido" });
  getFromFactiliza(`/cee/info/${req.query.cee}`, res);
});

app.get("/placa", (req, res) => {
  if (!req.query.placa)
    return res.status(400).json({ success: false, message: "placa requerida" });
  getFromFactiliza(`/placa/soat/${req.query.placa}`, res);
});

app.get("/licencia", (req, res) => {
  if (!req.query.dni)
    return res.status(400).json({ success: false, message: "dni requerido" });
  getFromFactiliza(`/licencia/info/${req.query.dni}`, res);
});

/* ============================
   Leder Data Endpoints (GET → POST)
============================ */
app.get("/reniec", (req, res) => {
  postToLederData("/persona/reniec", {
    dni: req.query.dni,
    source: req.query.source || "database",
  }, res);
});

app.get("/denuncias-dni", (req, res) => {
  postToLederData("/persona/denuncias-policiales-dni", { dni: req.query.dni }, res);
});

app.get("/denuncias-placa", (req, res) => {
  postToLederData("/persona/denuncias-policiales-placa", { placa: req.query.placa }, res);
});

app.get("/sueldos", (req, res) => {
  postToLederData("/persona/sueldos", { dni: req.query.dni }, res);
});

app.get("/trabajos", (req, res) => {
  postToLederData("/persona/trabajos", { dni: req.query.dni }, res);
});

app.get("/sunat", (req, res) => {
  postToLederData("/empresa/sunat", { data: req.query.data }, res);
});

app.get("/sunat-razon", (req, res) => {
  postToLederData("/empresa/sunat/razon-social", { data: req.query.data }, res);
});

app.get("/consumos", (req, res) => {
  postToLederData("/persona/consumos", { dni: req.query.dni }, res);
});

app.get("/arbol", (req, res) => {
  postToLederData("/persona/arbol-genealogico", { dni: req.query.dni }, res);
});

app.get("/familia1", (req, res) => {
  postToLederData("/persona/familia-1", { dni: req.query.dni }, res);
});

app.get("/familia2", (req, res) => {
  postToLederData("/persona/familia-2", { dni: req.query.dni }, res);
});

app.get("/familia3", (req, res) => {
  postToLederData("/persona/familia-3", { dni: req.query.dni }, res);
});

app.get("/movimientos", (req, res) => {
  postToLederData("/persona/movimientos-migratorios", { dni: req.query.dni }, res);
});

app.get("/matrimonios", (req, res) => {
  postToLederData("/persona/matrimonios", { dni: req.query.dni }, res);
});

app.get("/empresas", (req, res) => {
  postToLederData("/persona/empresas", { dni: req.query.dni }, res);
});

app.get("/direcciones", (req, res) => {
  postToLederData("/persona/direcciones", { dni: req.query.dni }, res);
});

app.get("/correos", (req, res) => {
  postToLederData("/persona/correos", { dni: req.query.dni }, res);
});

app.get("/telefonia-doc", (req, res) => {
  postToLederData("/telefonia/documento", { documento: req.query.documento }, res);
});

app.get("/telefonia-num", (req, res) => {
  postToLederData("/telefonia/numero", { numero: req.query.numero }, res);
});

app.get("/vehiculos", (req, res) => {
  postToLederData("/vehiculos/sunarp", { placa: req.query.placa }, res);
});

app.get("/fiscalia-dni", (req, res) => {
  postToLederData("/persona/justicia/fiscalia/dni", { dni: req.query.dni }, res);
});

app.get("/fiscalia-nombres", (req, res) => {
  postToLederData("/persona/justicia/fiscalia/nombres", {
    nombres: req.query.nombres,
    apepaterno: req.query.apepaterno,
    apematerno: req.query.apematerno,
  }, res);
});

/* ============================
   Default
============================ */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🚀 API Consulta pe-clon funcionando correctamente con Factiliza + Leder Data",
  });
});

/* ============================
   Servidor
============================ */
app.listen(PORT, () => {
  console.log(`✅ API corriendo en puerto ${PORT}`);
});

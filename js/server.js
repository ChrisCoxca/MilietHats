const PAYPAL_CLIENT_ID = "PON_AQUI_EL_CLIENT_ID_DE_TU_CLIENTE";
const PAYPAL_CLIENT_SECRET = "PON_AQUI_LA_SECRET_KEY_QUE_TE_PASARON";
const PAYPAL_API = "https://api-m.paypal.com"; // Usa "https://api-m.sandbox.paypal.com" si fuera prueba
const express = require("express");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
const multer = require("multer");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
// ===== Configuración Multer para imágenes =====
const upload = multer({ dest: path.join(__dirname, "uploads") });

// Función auxiliar para verificar el pago con PayPal
async function verificarPagoPayPal(orderID) {
    try {
        // 1. Obtener Token de Acceso
        const auth = Buffer.from(PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET).toString("base64");
        const tokenRes = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
            method: "POST",
            body: "grant_type=client_credentials",
            headers: {
                "Authorization": `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });
        const tokenData = await tokenRes.json();
        
        if (!tokenData.access_token) return false;

        // 2. Consultar detalles de la orden
        const ordenRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}`, {
            headers: {
                "Authorization": `Bearer ${tokenData.access_token}`
            }
        });
        const ordenData = await ordenRes.json();

        // 3. Verificar que esté completada (COMPLETED o APPROVED)
        return ordenData.status === "COMPLETED" || ordenData.status === "APPROVED";
    } catch (error) {
        console.error("Error verificando PayPal:", error);
        return false;
    }
}

// ===== Middleware =====
app.use(bodyParser.json());
// Nota: Puedes reemplazar bodyParser.json() por app.use(express.json())
app.use(express.static(path.join(__dirname, ".."))); // sirve HTML, JS, CSS
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// ===== Rutas Pedidos =====
app.get("/api/pedidos", (req, res) => {
  db.all("SELECT * FROM pedidos ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// RUTA POST /api/pedidos (ÚNICA Y CORREGIDA: Registra pedido y actualiza stock)
app.post("/api/pedidos", async (req, res) => { // Nota el 'async' aquí
  const { nombre, telefono, direccion, total, estado, paypalOrderID, carrito } = req.body;

  // VERIFICACIÓN DE SEGURIDAD (Nuevo paso)
  if (paypalOrderID) {
      const esValido = await verificarPagoPayPal(paypalOrderID);
      if (!esValido) {
          return res.status(400).json({ error: "El pago no pudo ser verificado con PayPal o no fue completado." });
      }
  }

  // Si pasa la verificación, guardamos normalmente...
  const stmt = db.prepare(`
    INSERT INTO pedidos (nombre, telefono, direccion, total, estado, paypalOrderID, carrito)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    nombre || "", telefono || "", direccion || "",
    parseFloat(total) || 0, estado || "Pagado",
    paypalOrderID || "",
    JSON.stringify(carrito || []),
    function (err) {
      if (err) {
        console.error("Error al insertar el pedido:", err.message);
        return res.status(500).json({ error: err.message });
      }

      // Actualizar stock
      (carrito || []).forEach(item => {
        db.get("SELECT stock FROM productos WHERE id=?", [item.id], (err, row) => {
          if(err) return console.error("Error al consultar stock:", err.message); 
          if(row && row.stock >= item.quantity){
            db.run("UPDATE productos SET stock = stock - ? WHERE id=?", [item.quantity, item.id]);
          } else {
            console.warn(`Stock insuficiente para ${item.id}`);
          }
        });
      });

      res.json({ mensaje: "Pedido verificado y registrado", id: this.lastID });
    }
  );
});


app.put("/api/pedidos/:id", (req, res) => {
  const { estado } = req.body;
  db.run(
    "UPDATE pedidos SET estado=? WHERE id=?",
    [estado, req.params.id],
    function(err){
      if(err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Pedido actualizado" });
    }
  );
});

app.delete("/api/pedidos/:id", (req, res) => {
  db.run("DELETE FROM pedidos WHERE id=?", req.params.id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: "Pedido eliminado" });
  });
});

// ===== Rutas Productos =====
app.get("/api/productos", (req, res) => {
  db.all("SELECT * FROM productos", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    rows.forEach(r => {
      try { r.images = JSON.parse(r.images || "[]"); } catch { r.images = []; }
      r.agotado = r.stock <= 0; // nueva propiedad para frontend
    });

    res.json(rows);
  });
});

// RUTA PUT /api/productos/:id (Actualizar producto. Límite de 10 imágenes)
app.put("/api/productos/:id", upload.array("imagenes", 10), (req, res) => {
  const { name, price, stock, description } = req.body;
  const newImages = (req.files || []).map(f => `/uploads/${f.filename}`);
  
  if (newImages.length > 0) {
    db.run(
      `UPDATE productos SET name=?, price=?, stock=?, description=?, images=? WHERE id=?`,
      [name, parseFloat(price), parseInt(stock), description || "", JSON.stringify(newImages), req.params.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Producto actualizado (con nuevas imágenes)" });
      }
    );
  } else {
    db.run(
      `UPDATE productos SET name=?, price=?, stock=?, description=? WHERE id=?`,
      [name, parseFloat(price), parseInt(stock), description || "", req.params.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Producto actualizado" });
      }
    );
  }
});

// RUTA POST /api/productos (Agregar nuevo producto. Límite de 10 imágenes)
app.post("/api/productos", upload.array("imagenes", 10), (req, res) => {
  const { name, price, stock, description } = req.body;
  const images = (req.files || []).map(f => `/uploads/${f.filename}`);

  const stmt = db.prepare(`
    INSERT INTO productos (name, price, stock, description, images)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    name || "",
    parseFloat(price) || 0,
    parseInt(stock) || 0,
    description || "",
    JSON.stringify(images),
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Producto agregado", id: this.lastID });
    }
  );
});


app.delete("/api/productos/:id", (req, res) => {
  db.run("DELETE FROM productos WHERE id=?", req.params.id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: "Producto eliminado" });
  });
});


// ===== Servir archivos HTML =====
app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname,"..", "admin.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname,"..", "index.html"));
});

// ===== Iniciar servidor =====
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
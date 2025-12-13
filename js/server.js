const express = require("express");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
const multer = require("multer");
const db = require("./db");

const app = express();
const PORT = 3000;

// ===== Configuración Multer para imágenes =====
const upload = multer({ dest: path.join(__dirname, "uploads") });


// ===== Middleware =====
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, ".."))); // sirve HTML, JS, CSS
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// ===== Rutas Pedidos =====
app.get("/api/pedidos", (req, res) => {
  db.all("SELECT * FROM pedidos ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/pedidos", (req, res) => {
  const { nombre, telefono, direccion, total, estado, paypalOrderID, carrito } = req.body;

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
      if (err) return res.status(500).json({ error: err.message });

      // Actualizar stock
        (carrito || []).forEach(item => {
        db.get("SELECT stock FROM productos WHERE id=?", [item.id], (err, row) => {
            if(err) return console.error(err.message);
            if(row && row.stock >= item.quantity){
            db.run("UPDATE productos SET stock = stock - ? WHERE id=?", [item.quantity, item.id]);
            } else {
            console.warn(`No hay suficiente stock para ${item.id} (${item.quantity})`);
            }
        });
        });


      res.json({ mensaje: "Pedido registrado y stock actualizado", id: this.lastID });
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


app.post("/api/pedidos", (req, res) => {
  const { nombre, telefono, direccion, total, paypalOrderID, carrito } = req.body;

  const stmt = db.prepare(`
    INSERT INTO pedidos (nombre, telefono, direccion, total, estado, paypalOrderID, carrito)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    nombre || "", telefono || "", direccion || "",
    parseFloat(total) || 0, 
    "nuevo",  // <-- siempre inicia pendiente
    paypalOrderID || "",
    carrito ? JSON.stringify(carrito) : null,    
  function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Pedido registrado", id: this.lastID });
    }
  );
});


app.put("/api/productos/:id", upload.array("imagenes", 5), (req, res) => {
  const { name, price, stock, description } = req.body;
  const newImages = (req.files || []).map(f => `/uploads/${f.filename}`);
  // Si subieron nuevas imágenes, se reemplaza el array; si no, se conservan
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
// ===== Agregar nuevo producto =====
// ===== Agregar nuevo producto =====
app.post("/api/productos", upload.array("imagenes", 5), (req, res) => {
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


// ===== Servir admin.html =====
app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname,"..", "admin.html"));
});

// ===== Página principal =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname,"..", "index.html"));
});

// ===== Iniciar servidor =====
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));

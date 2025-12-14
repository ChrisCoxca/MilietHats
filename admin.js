document.addEventListener("DOMContentLoaded", async () => {
  // ==== Login simple ====
  const user = prompt("Usuario:");
  const pass = prompt("Contraseña:");
  if (user !== "admin" || pass !== "1234") {
    alert("Acceso denegado");
    window.location.href = "index.html";
    return;
  }

  // ==== Selectores Inventario ====
  const inventarioTableBody = document.querySelector("#inventario-table tbody");
  const form = document.getElementById("producto-form");
  const nombreInput = document.getElementById("nombre");
  const precioInput = document.getElementById("precio");
  const stockInput = document.getElementById("stock");
  const descripcionInput = document.getElementById("descripcion");
  const imagenesInput = document.getElementById("imagenes");
  let editId = null;

  // ==== Helpers Pedidos ====
  function botonesAcciones() {
    return `
      <div class="d-flex gap-1">
        <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-secondary" data-estado="pendiente">Pendiente</button>
            <button class="btn btn-warning" data-estado="listo">Listo</button>
            <button class="btn btn-info" data-estado="en_camino">En camino</button>
            <button class="btn btn-success" data-estado="entregado">Entregado</button>
        </div>
        <button class="btn btn-sm btn-danger btn-eliminar-pedido">X</button>
      </div>
    `;
  }

  function engancharAcciones(tr, pedido) {
    // 1. Lógica de los botones de estado (ya la tenías)
    tr.querySelectorAll("button[data-estado]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const nuevoEstado = btn.getAttribute("data-estado");
        await fetch(`/api/pedidos/${pedido.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: nuevoEstado })
        });
        await cargarPedidos();
        // ... (tu lógica de scroll se mantiene igual)
      });
    });

    // 2. NUEVA Lógica para eliminar pedido
    const btnEliminar = tr.querySelector(".btn-eliminar-pedido");
    if (btnEliminar) {
        btnEliminar.addEventListener("click", async () => {
            if (confirm(`¿Estás seguro de eliminar el pedido #${pedido.id}?`)) {
                try {
                    await fetch(`/api/pedidos/${pedido.id}`, { method: "DELETE" });
                    await cargarPedidos(); // Recarga la tabla
                } catch (error) {
                    console.error(error);
                    alert("Error al eliminar");
                }
            }
        });
    }
  }

  // ==== PEDIDOS ====
  async function cargarPedidos() {
    try {
      const res = await fetch("/api/pedidos");
      if (!res.ok) throw new Error("Error al obtener pedidos");
      const pedidos = await res.json();

      const tbodyGeneral   = document.querySelector("#pedidos-table tbody");
      const pendientesBody = document.querySelector("#pendientes tbody");
      const listosBody     = document.querySelector("#listos tbody");
      const caminoBody     = document.querySelector("#enCamino tbody");
      const entregadosBody = document.querySelector("#entregados tbody");

      // limpiar
      [tbodyGeneral, pendientesBody, listosBody, caminoBody, entregadosBody].forEach(t => t.innerHTML = "");

      pedidos.forEach(pedido => {
        let estado = (pedido.estado || "nuevo").toLowerCase();
        
        // --- CORRECCIÓN CLAVE ---
        // Si viene como "pagado" o "nuevo", lo tratamos como pendiente para que se vea
        if (estado === "pagado" || estado === "nuevo") {
            estado = "pendiente";
        }
        
        const totalFmt = `$${Number(pedido.total || 0).toFixed(2)}`;
        let carritoHTML = "No se registraron productos";

        try {
          if (pedido.carrito) {
            // Verifica si es un string JSON o ya es un objeto
            const arr = typeof pedido.carrito === 'string' ? JSON.parse(pedido.carrito) : pedido.carrito;
            if(Array.isArray(arr)) {
                carritoHTML = arr.map(prod => `${prod.name} x${prod.quantity}`).join(", ");
            }
          }
        } catch (e) {
            console.error("Error parseando carrito", e);
        }

        function filaCompleta(p) {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${p.id}</td>
            <td>${p.paypalOrderID || ""}</td>
            <td>${p.nombre || ""}</td>
            <td>${p.telefono || ""}</td>
            <td>${p.direccion || ""}</td>
            <td>${totalFmt}</td>
            <td>${estado}</td> <td>${carritoHTML}</td>
            <td>${botonesAcciones()}</td>
          `;
          engancharAcciones(tr, p);
          return tr;
        }

        // 1. Tabla General: Mostrar TODOS los pedidos (Historial completo)
        tbodyGeneral.appendChild(filaCompleta(pedido));

        // 2. Tablas por estado específico
        if (estado === "pendiente") pendientesBody.appendChild(filaCompleta(pedido));
        else if (estado === "listo") listosBody.appendChild(filaCompleta(pedido));
        else if (estado === "en_camino") caminoBody.appendChild(filaCompleta(pedido));
        else if (estado === "entregado") entregadosBody.appendChild(filaCompleta(pedido));
      });
    } catch (err) {
      console.error("Error en cargarPedidos:", err);
    }
  }

  // ==== INVENTARIO ====
  async function cargarInventario() {
    try {
      const res = await fetch("/api/productos");
      const productos = await res.json();
      inventarioTableBody.innerHTML = "";

      productos.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${item.name}</td>
          <td>$${Number(item.price).toFixed(2)}</td>
          <td>${item.stock}</td>
          <td>
            <button class="btn btn-sm btn-primary">Editar</button>
            <button class="btn btn-sm btn-danger">Eliminar</button>
          </td>
        `;

        // Editar
        row.querySelector(".btn-primary").addEventListener("click", () => {
          editId = item.id;
          nombreInput.value = item.name;
          precioInput.value = item.price;
          stockInput.value = item.stock;
          descripcionInput.value = item.description || "";
          form.style.display = "block";
        });

        // Eliminar
        row.querySelector(".btn-danger").addEventListener("click", async () => {
          if (confirm(`¿Eliminar ${item.name}?`)) {
            try {
              await fetch(`/api/productos/${item.id}`, { method: "DELETE" });
              cargarInventario();
            } catch (e) {
              console.error(e);
              alert("No se pudo eliminar el producto.");
            }
          }
        });

        inventarioTableBody.appendChild(row);
      });
    } catch (err) {
      console.error(err);
      alert("Error cargando inventario");
    }
  }

  // Agregar producto
  document.getElementById("agregar-producto-btn").addEventListener("click", () => {
    editId = null;
    form.reset();
    form.style.display = "block";
  });

  // Guardar producto (nuevo o editado) con imágenes
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("name", nombreInput.value);
      formData.append("price", precioInput.value);
      formData.append("stock", stockInput.value);
      formData.append("description", descripcionInput.value);

      for (let i = 0; i < imagenesInput.files.length; i++) {
        formData.append("imagenes", imagenesInput.files[i]);
      }

      if (editId) {
        await fetch(`/api/productos/${editId}`, {
          method: "PUT",
          body: formData
        });
      } else {
        await fetch("/api/productos", {
          method: "POST",
          body: formData
        });
      }

      form.reset();
      form.style.display = "none";
      await cargarInventario();
    } catch (err) {
      console.error(err);
      alert("No se pudo guardar el producto.");
    }
  });

  // === Cargar todo al iniciar ===
  cargarPedidos();
  cargarInventario();
});
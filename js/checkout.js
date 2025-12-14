document.addEventListener("DOMContentLoaded", () => {
  // Ajusta este valor al costo de envío real. En tu HTML dice 250, aquí pongo 250.
  const shippingCost = 250; 
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  const cartSummary = document.getElementById("cart-summary");
  const totalFinalElem = document.getElementById("total-final");
  const form = document.getElementById("checkout-form");

  // ==========================================
  // 1. FUNCIÓN PARA RENDERIZAR EL CARRITO CON BOTONES
  // ==========================================
  function renderCart() {
    if (!cartSummary) return 0;

    // Si el carrito está vacío
    if (cart.length === 0) {
      cartSummary.innerHTML = "<p class='text-center'>Tu carrito está vacío.</p>";
      totalFinalElem.innerText = "0.00";
      return 0;
    }

    let html = "<div class='list-group'>";
    let total = 0;

    cart.forEach((item, index) => {
      const subtotal = item.price * item.quantity;
      total += subtotal;

      // Aquí agregamos los botones de +, - y Eliminar
      html += `
        <div class="list-group-item d-flex align-items-center gap-3">
          <img src="${item.image}" alt="${item.name}" style="width:80px;height:80px;object-fit:cover;border-radius:5px;">
          
          <div class="flex-grow-1">
            <h6 class="mb-1">${item.name}</h6>
            <p class="mb-1">Precio Unitario: $${item.price.toFixed(2)}</p>
            
            <div class="d-flex align-items-center gap-2 mt-2">
                <button class="btn btn-sm btn-outline-light border-secondary text-dark" onclick="updateQty(${index}, -1)">-</button>
                
                <span class="fw-bold text-dark">${item.quantity}</span>
                
                <button class="btn btn-sm btn-outline-light border-secondary text-dark" onclick="updateQty(${index}, 1)">+</button>
                
                <button class="btn btn-sm btn-danger ms-auto" onclick="removeItem(${index})">
                    🗑️
                </button>
            </div>

            <p class="mb-0 mt-1 text-end"><strong>Subtotal: $${subtotal.toFixed(2)}</strong></p>
          </div>
        </div>
      `;
    });

    html += "</div>";
    cartSummary.innerHTML = html;

    // Calcular Total Final
    const totalFinal = total + shippingCost;
    totalFinalElem.innerText = totalFinal.toFixed(2);

    // Guardar el total para PayPal
    localStorage.setItem("totalCarrito", totalFinal.toFixed(2));

    return totalFinal;
  }

  // ==========================================
  // 2. FUNCIONES GLOBALES PARA MODIFICAR CARRITO
  // ==========================================
  
  // Función para aumentar o disminuir cantidad
  window.updateQty = (index, change) => {
    if (cart[index].quantity + change > 0) {
        cart[index].quantity += change;
    } else {
        // Si baja a 0, preguntamos si quiere eliminar
        if(confirm("¿Quieres eliminar este producto?")){
            cart.splice(index, 1);
        }
    }
    updateLocalStorage();
  };

  // Función para eliminar producto totalmente
  window.removeItem = (index) => {
    if(confirm("¿Eliminar producto del carrito?")){
        cart.splice(index, 1);
        updateLocalStorage();
    }
  };

  // Helper para guardar y refrescar
  function updateLocalStorage() {
    localStorage.setItem("cart", JSON.stringify(cart));
    renderCart(); // Volver a dibujar para ver cambios
    
    // Opcional: Si tienes un contador en el navbar, intenta actualizarlo
    // (Esto depende de tu archivo funciones.js)
    if(typeof actualizarContadorCarrito === 'function') {
        actualizarContadorCarrito(); 
    }
  }

  // ==========================================
  // 3. INICIALIZACIÓN
  // ==========================================
  
  // Render inicial
  renderCart();

  // Evitar recarga del form
  if (form) {
    form.addEventListener("submit", e => e.preventDefault());
  }

  // ==========================================
  // 4. LÓGICA DE PAYPAL
  // ==========================================
  if (window.paypal) {
    paypal.Buttons({
      createOrder: function (data, actions) {
        let nombre = document.getElementById("nombre").value.trim();
        let telefono = document.getElementById("telefono").value.trim();
        let direccion = document.getElementById("direccion").value.trim();

        if (!nombre || !telefono || !direccion) {
            // Usamos alert porque el reject de paypal a veces no se ve claro en UI
            alert("Por favor completa Nombre, Teléfono y Dirección antes de pagar.");
            return actions.reject();
        }

        if (!cart || cart.length === 0) {
            alert("El carrito está vacío.");
            return actions.reject();
        }

        // Recalcular total justo antes de crear la orden por seguridad
        let total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
        total += shippingCost;

        return actions.order.create({
          purchase_units: [{
            amount: { value: total.toFixed(2) }
          }]
        });
      },

      onApprove: function (data, actions) {
        let nombre = document.getElementById("nombre").value.trim();
        let telefono = document.getElementById("telefono").value.trim();
        let direccion = document.getElementById("direccion").value.trim();
        let total = parseFloat(localStorage.getItem("totalCarrito")) || 0;

        return fetch('/api/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre,
            telefono,
            direccion,
            total,
            estado: "Pagado",
            paypalOrderID: data.orderID,
            carrito: cart
          })
        })
          .then(res => res.json())
          .then(res => {
            alert("¡Pedido registrado con éxito! Gracias por tu compra.");
            localStorage.removeItem("cart");
            localStorage.removeItem("totalCarrito");
            window.location.href = "index.html";
          })
          .catch(err => {
              console.error(err);
              alert("Hubo un error al registrar el pedido en la base de datos, pero el pago pasó. Contáctanos.");
          });
      },

      onError: err => {
        console.error(err);
        alert("Error en el proceso de pago de PayPal.");
      }
    }).render('#paypal-button-container');
  }
});
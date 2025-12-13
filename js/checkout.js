document.addEventListener("DOMContentLoaded", () => {
  const shippingCost = 54;
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  const cartSummary = document.getElementById("cart-summary");
  const totalFinalElem = document.getElementById("total-final");
  const form = document.getElementById("checkout-form");

  // Renderiza el carrito
  function renderCart() {
    if (!cartSummary) return 0;

    if (cart.length === 0) {
      cartSummary.innerHTML = "<p>Tu carrito está vacío.</p>";
      totalFinalElem.innerText = "0.00";
      return 0;
    }

    let html = "<div class='list-group'>";
    let total = 0;

    cart.forEach(item => {
      const subtotal = item.price * item.quantity;
      total += subtotal;
      html += `
        <div class="list-group-item d-flex align-items-center gap-3">
          <img src="${item.image}" alt="${item.name}" style="width:80px;height:80px;object-fit:cover;border-radius:5px;">
          <div class="flex-grow-1">
            <h6 class="mb-1">${item.name}</h6>
            <p class="mb-1">Precio: $${item.price.toFixed(2)}</p>
            <p class="mb-1">Cantidad: ${item.quantity}</p>
            <p class="mb-0"><strong>Subtotal: $${subtotal.toFixed(2)}</strong></p>
          </div>
        </div>
      `;
    });

    html += "</div>";
    cartSummary.innerHTML = html;

    const totalFinal = total + shippingCost;
    totalFinalElem.innerText = totalFinal.toFixed(2);

    // Guardar en localStorage
    localStorage.setItem("totalCarrito", totalFinal.toFixed(2));

    return totalFinal;
  }

  renderCart();

  // Evitar submit tradicional del form
  if (form) {
    form.addEventListener("submit", e => e.preventDefault());
  }

  // Configurar PayPal
  if (window.paypal) {
    paypal.Buttons({
      createOrder: function (data, actions) {
        // Obtener datos del formulario
        let nombre = document.getElementById("nombre").value.trim();
        let telefono = document.getElementById("telefono").value.trim();
        let direccion = document.getElementById("direccion").value.trim();

        // Validaciones
        if (!nombre || !telefono || !direccion) {
    return new Promise((resolve, reject) => 
        reject(new Error("Por favor completa todos los campos antes de pagar."))
    );
}

if (!cart || cart.length === 0) {
    return new Promise((resolve, reject) => 
        reject(new Error("El carrito está vacío. Agrega productos antes de pagar."))
    );
}


        // Calcular total dinámicamente
        let total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
        total += shippingCost;
        localStorage.setItem("totalCarrito", total.toFixed(2));

        // Crear orden de PayPal
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
            alert("Pedido registrado con éxito");
            localStorage.removeItem("cart");
            localStorage.removeItem("totalCarrito");
            window.location.href = "index.html";
          });
      },

      onError: err => {
        console.error(err);
        alert(err.message);
      }
    }).render('#paypal-button-container');
  }
});

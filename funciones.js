// ===== Ruta por defecto =====
const DEFAULT_IMG = '/uploads/default.png'; // asegúrate de que exista en tu servidor

// ===== Carrito en memoria persistente =====
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// ===== Actualizar carrito en la navbar =====
function updateCart() {
  const cartItems = document.getElementById('cart-items');
  const cartCount = document.getElementById('cart-count');
  const cartTotal = document.getElementById('cart-total');
  if (!cartItems || !cartCount || !cartTotal) return;

  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="text-center">Tu carrito está vacío</p>';
    cartTotal.innerText = '0.00';
    cartCount.innerText = '0';
    localStorage.setItem('cart', JSON.stringify(cart));
    return;
  }

  let total = 0;
  cartItems.innerHTML = '';
  cart.forEach((item, index) => {
    total += item.price * item.quantity;
    cartItems.innerHTML += `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="d-flex align-items-center gap-2">
          <img src="${item.image || DEFAULT_IMG}" alt="${item.name}" style="width:50px; height:50px; border-radius:5px;">
          <div>
            <strong>${item.name}</strong><br>$${item.price.toFixed(2)}
          </div>
        </div>
        <div class="d-flex align-items-center gap-1">
          <button class="btn btn-sm btn-secondary" onclick="changeQuantity(${index}, -1, event)">-</button>
          <span>${item.quantity}</span>
          <button class="btn btn-sm btn-secondary" onclick="changeQuantity(${index}, 1, event)">+</button>
        </div>
      </div>
    `;
  });

  cartTotal.innerText = total.toFixed(2);
  cartCount.innerText = cart.reduce((acc, item) => acc + item.quantity, 0);
  localStorage.setItem('cart', JSON.stringify(cart));
}

// ===== Cambiar cantidad =====
function changeQuantity(index, delta, event) {
  if(event) event.stopPropagation();
  cart[index].quantity += delta;
  if(cart[index].quantity <= 0) cart.splice(index, 1);
  updateCart();
}

// ===== Agregar producto =====
async function addToCart(id, cantidad = 1) {
  const res = await fetch('/api/productos');
  const productos = await res.json();
  const producto = productos.find(p => p.id === id);
  if (!producto) return alert('Producto no encontrado');
  if (producto.agotado || producto.stock <= 0) return alert('Producto agotado');

  const existing = cart.find(item => item.id === id);
  const cantidadActual = existing ? existing.quantity : 0;

  if (cantidadActual + cantidad > producto.stock) {
    return alert(`No puedes agregar más de ${producto.stock} unidades al carrito`);
  }

  const img = (Array.isArray(producto.images) && producto.images.length > 0) ? producto.images[0] : DEFAULT_IMG;


  if (existing) {
    existing.quantity += cantidad;
  } else {
    cart.push({
      id: producto.id,
      name: producto.name,
      price: producto.price,
      image: img,
      quantity: cantidad
    });
  }

  updateCart();
}

// ===== Comprar ahora =====
async function buyNowProduct(id) {
  await addToCart(id, 1);
  goToCheckout();
}

// ===== Ir a checkout =====
function goToCheckout() {
  if (!Array.isArray(cart)) cart = [];
  if (cart.length === 0) return alert('Tu carrito está vacío');
  window.location.href = 'checkout.html';
}

// ===== Cargar catálogo =====
async function cargarCatalogo() {
  const res = await fetch('/api/productos');
  const productos = await res.json();
  const catalogoSection = document.getElementById('catalogo');
  if(!catalogoSection) return;
  catalogoSection.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'row g-4 justify-content-center';

  productos.forEach(p => {
    const col = document.createElement('div');
    col.className = 'col-md-4 col-sm-6';

    const imgs = (Array.isArray(p.images) && p.images.length > 0) ? p.images : [DEFAULT_IMG];
    const img = imgs[0];

    col.innerHTML = `
      <div class="catalogo-card" onclick="window.location.href='producto.html?id=${p.id}'">
        <img src="${img}" alt="${p.name}">
        <div class="catalogo-texto">
          <div>${p.name}</div>
          <div class="fw-bold">$${p.price} MXN</div>
        </div>
      </div>
    `;

    row.appendChild(col);
  });

  catalogoSection.appendChild(row);
}

// ===== Cargar producto individual =====
async function cargarProducto() {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get('id'));
  if(!id) return;

  const res = await fetch('/api/productos');
  const productos = await res.json();
  const p = productos.find(prod => prod.id === id);
  if(!p) return;

  // Asegurarse de que imgs sea un array
  let imgs = [];
  if (Array.isArray(p.images) && p.images.length > 0) {
    imgs = p.images;
  } else if (typeof p.images === 'string' && p.images.length > 0) {
    imgs = [p.images];
  } else {
    imgs = ['/uploads/default.png']; // ruta de default válida
  }

  console.log('Imágenes del producto:', imgs);

 

  // Carrusel
  const carouselInner = document.getElementById('carousel-inner');
  if(carouselInner){
    carouselInner.innerHTML = '';
    if(imgs.length > 0){
      imgs.forEach((img, index) => {
        const active = index === 0 ? 'active' : '';
        carouselInner.innerHTML += `
          <div class="carousel-item ${active}">
            <img src="${img}" class="d-block w-100" alt="${p.name} ${index+2}">
          </div>
        `;
      });
    } else {
      carouselInner.innerHTML = '<div class="text-center text-white">No hay más imágenes</div>';
    }
  }

  document.getElementById('producto-nombre').innerText = p.name;
  document.getElementById('producto-precio').innerText = `$${p.price} MXN`;
  document.getElementById('producto-descripcion').innerText = p.description || '';

  // Botones
  const agregarBtn = document.getElementById('producto-agregar');
  const comprarBtn = document.getElementById('producto-comprar');
  if(agregarBtn) agregarBtn.onclick = () => addToCart(p.id);
  if(comprarBtn) comprarBtn.onclick = () => buyNowProduct(p.id);
}


// ===== Ejecutar al cargar =====
document.addEventListener('DOMContentLoaded', () => {
  cargarCatalogo();
  cargarProducto();
  updateCart();
});

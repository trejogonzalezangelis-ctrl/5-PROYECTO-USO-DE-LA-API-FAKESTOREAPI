// ============ CONFIGURACIÓN ============
const API = 'https://fakestoreapi.com/products';
const NEGOCIO = 'AGEL SHOP TAREA';
let productos = [];                                    // lista traída de la API
let carrito = JSON.parse(localStorage.getItem('carrito') || '[]'); // persistencia
let productoActual = null;                             // producto abierto en el modal

// Atajo para buscar elementos por id
const $ = id => document.getElementById(id);
const dinero = n => Number(n).toFixed(2);

// ============ 1. CONSUMIR LA API (Fetch) ============
async function cargarProductos() {
  try {
    const resp = await fetch(API);
    if (!resp.ok) throw new Error('Respuesta no válida');
    productos = await resp.json();
    pintarProductos();
  } catch (e) {
    $('productos').innerHTML = '<p class="text-danger">No se pudieron cargar los productos. Revisa tu conexión.</p>';
  }
}

// ============ 2. DIBUJAR TARJETAS ============
function pintarProductos() {
  $('productos').innerHTML = productos.map(p => `
    <div class="col-12 col-sm-6 col-lg-3 fade-in">
      <div class="card card-producto">
        <img src="${p.image}" class="card-img-top" alt="${p.title}">
        <div class="card-body d-flex flex-column">
          <h2 class="titulo-card" title="${p.title}">${p.title}</h2>
          <p class="precio mt-auto">$${dinero(p.price)}</p>
          <button class="btn btn-primary" onclick="verMas(${p.id})">🔍 Ver más</button>
        </div>
      </div>
    </div>`).join('');
}

// ============ 3. MODAL DE DETALLE ============
function verMas(id) {
  productoActual = productos.find(p => p.id === id);
  $('mTitulo').textContent = productoActual.title;
  $('mImagen').src = productoActual.image;
  $('mCategoria').textContent = productoActual.category;
  $('mDescripcion').textContent = productoActual.description;
  $('mPrecio').textContent = dinero(productoActual.price);
  $('mCantidad').value = 1;
  bootstrap.Modal.getOrCreateInstance($('modalProducto')).show();
}

$('mAgregar').addEventListener('click', () => {
  const cant = Math.max(1, parseInt($('mCantidad').value) || 1);
  const existente = carrito.find(i => i.id === productoActual.id);
  if (existente) existente.qty += cant;
  else carrito.push({ id: productoActual.id, title: productoActual.title, price: productoActual.price, image: productoActual.image, qty: cant });
  guardarCarrito();
  bootstrap.Modal.getInstance($('modalProducto')).hide();
  alerta('✅ Producto agregado al carrito', 'success');
});

// ============ 4. CARRITO ============
function guardarCarrito() {
  localStorage.setItem('carrito', JSON.stringify(carrito));
  pintarCarrito();
}

function pintarCarrito() {
  $('contador').textContent = carrito.reduce((s, i) => s + i.qty, 0);
  $('total').textContent = dinero(totalCarrito());
  $('listaCarrito').innerHTML = carrito.length ? carrito.map(i => `
    <div class="item-carrito">
      <img src="${i.image}" alt="">
      <div class="info">
        <div>${i.title.slice(0, 40)}${i.title.length > 40 ? '…' : ''}</div>
        <div class="text-muted">$${dinero(i.price)}</div>
      </div>
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-secondary" onclick="cambiarQty(${i.id}, -1)" aria-label="Quitar uno">−</button>
        <span class="btn btn-light disabled">${i.qty}</span>
        <button class="btn btn-outline-secondary" onclick="cambiarQty(${i.id}, 1)" aria-label="Agregar uno">➕</button>
      </div>
      <button class="btn btn-sm btn-outline-danger" onclick="eliminar(${i.id})" aria-label="Eliminar">🗑️</button>
    </div>`).join('') : '<p class="text-muted">Tu carrito está vacío. ¡Agrega algo! 🛍️</p>';
}

const totalCarrito = () => carrito.reduce((s, i) => s + i.price * i.qty, 0);

function cambiarQty(id, delta) {
  const item = carrito.find(i => i.id === id);
  item.qty += delta;
  if (item.qty < 1) return eliminar(id);
  guardarCarrito();
}
function eliminar(id) {
  carrito = carrito.filter(i => i.id !== id);
  guardarCarrito();
}

// ============ 5. PASARELA DE PAGO (simulada) ============
$('btnPagar').addEventListener('click', () => {
  if (!carrito.length) return alerta('⚠️ Tu carrito está vacío', 'warning');
  bootstrap.Offcanvas.getInstance($('carrito')).hide();
  bootstrap.Modal.getOrCreateInstance($('modalPago')).show();
});

// Da formato al escribir: tarjeta en grupos de 4 y vencimiento MM/AA
$('pTarjeta').addEventListener('input', e => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
});
$('pVence').addEventListener('input', e => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 4);
  if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
  e.target.value = v;
});

function venceVigente(txt) {
  const m = /^(\d{2})\/(\d{2})$/.exec(txt);
  if (!m) return false;
  const mes = +m[1], anio = 2000 + +m[2];
  const hoy = new Date();
  return mes >= 1 && mes <= 12 && (anio > hoy.getFullYear() || (anio === hoy.getFullYear() && mes >= hoy.getMonth() + 1));
}

$('formPago').addEventListener('submit', e => {
  e.preventDefault();
  const nombre = $('pNombre').value.trim();
  const tarjeta = $('pTarjeta').value.replace(/\s/g, '');
  const reglas = [
    [$('pNombre'), nombre.length >= 3],
    [$('pTarjeta'), /^\d{16}$/.test(tarjeta)],
    [$('pVence'), venceVigente($('pVence').value)],
    [$('pCvv'), /^\d{3,4}$/.test($('pCvv').value)]
  ];
  reglas.forEach(([campo, ok]) => campo.classList.toggle('is-invalid', !ok));
  if (reglas.some(([, ok]) => !ok)) return;

  generarTicket(nombre, tarjeta.slice(-4));
  carrito = [];
  guardarCarrito();
  e.target.reset();
  bootstrap.Modal.getInstance($('modalPago')).hide();
  alerta('🎉 ¡Pago exitoso! Tu ticket se descargó.', 'success');
});

// ============ 6. TICKET PDF TIPO RECIBO TÉRMICO (80 mm) ============
function generarTicket(cliente, ultimos4) {
  const COLS = 40; // caracteres por línea (80 mm, Courier 8 pt)
  const linea = '-'.repeat(COLS);
  const centrar = t => ' '.repeat(Math.max(0, Math.floor((COLS - t.length) / 2))) + t;
  const izqDer = (a, b) => a + ' '.repeat(Math.max(1, COLS - a.length - b.length)) + b;
  const ahora = new Date();

  const l = [centrar(NEGOCIO), centrar('TICKET DE COMPRA'), linea,
    'Fecha:   ' + ahora.toLocaleDateString('es-DO'),
    'Hora:    ' + ahora.toLocaleTimeString('es-DO'),
    'Cliente: ' + cliente,
    'Tarjeta: **** ' + ultimos4, linea];

  carrito.forEach(i => {
    // Título partido en líneas de 40 caracteres como máximo
    (i.title.match(new RegExp('.{1,' + COLS + '}(\\s|$)', 'g')) || [i.title]).forEach(t => l.push(t.trim()));
    l.push(izqDer(`  ${i.qty} x $${dinero(i.price)}`, '$' + dinero(i.price * i.qty)));
  });

  l.push(linea, izqDer('TOTAL', '$' + dinero(totalCarrito())), linea, centrar('¡Gracias por su compra!'));

  const alto = l.length * 3.5 + 12; // alto dinámico según el contenido
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: [80, alto] });
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(8);
  l.forEach((t, n) => pdf.text(t, 5, 8 + n * 3.5)); // margen izquierdo de 5 mm
  pdf.save('ticket-' + Date.now() + '.pdf');
}

// ============ UTILIDADES ============
function alerta(msg, tipo) {
  const div = document.createElement('div');
  div.className = `alert alert-${tipo} shadow`;
  div.textContent = msg;
  $('alertas').appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// ============ INICIO ============
pintarCarrito();
cargarProductos();

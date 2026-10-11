let products = [
  {
    id: "tomatoes",
    name: "Farm Fresh Tomatoes",
    category: "Vegetables",
    weight: "500 g",
    price: 35,
    previousPrice: 45,
    rating: "4.9",
    badge: "PICKED TODAY",
    image: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=700&q=80",
    imageAlt: "Fresh ripe tomatoes"
  },
  {
    id: "apples",
    name: "Kashmiri Red Apples",
    category: "Fruits",
    weight: "4 pcs",
    price: 120,
    previousPrice: null,
    rating: "4.8",
    badge: "FARM FAVORITE",
    image: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=700&q=80",
    imageAlt: "Crisp red apples"
  },
  {
    id: "avocado",
    name: "Creamy avocados",
    category: "Fruits",
    weight: "2 pcs",
    price: 149,
    previousPrice: null,
    rating: "4.7",
    badge: "GOOD & GREEN",
    image: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=700&q=80",
    imageAlt: "Fresh avocados sliced in half"
  },
  {
    id: "carrots",
    name: "Sweet Baby Carrots",
    category: "Vegetables",
    weight: "500 g",
    price: 42,
    previousPrice: null,
    rating: "4.8",
    badge: "PICKED TODAY",
    image: "https://images.unsplash.com/photo-1445282768818-728615cc910a?auto=format&fit=crop&w=700&q=80",
    imageAlt: "Fresh carrots with green tops"
  },
  {
    id: "milk",
    name: "Farmhouse whole milk",
    category: "Dairy",
    weight: "1 litre",
    price: 68,
    previousPrice: null,
    rating: "4.9",
    badge: "LOCAL DAIRY",
    image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=700&q=80",
    imageAlt: "A glass of fresh milk"
  },
  {
    id: "strawberries",
    name: "Sweet strawberries",
    category: "Fruits",
    weight: "250 g",
    price: 99,
    previousPrice: 125,
    rating: "4.9",
    badge: "IN SEASON",
    image: "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=700&q=80",
    imageAlt: "Fresh red strawberries"
  },
  {
    id: "spinach",
    name: "Tender Baby Spinach",
    category: "Vegetables",
    weight: "200 g",
    price: 30,
    previousPrice: null,
    rating: "4.6",
    badge: "PICKED TODAY",
    image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=700&q=80",
    imageAlt: "A bundle of leafy green spinach"
  },
  {
    id: "oats",
    name: "Breakfast rolled oats",
    category: "Pantry",
    weight: "500 g",
    price: 95,
    previousPrice: null,
    rating: "4.7",
    badge: "PANTRY GOOD",
    image: "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=700&q=80",
    imageAlt: "A bowl of oats for breakfast"
  }
];

const state = {
  category: "All",
  search: "",
  sort: "featured",
  cart: new Map(),
  adminToken: null,
  adminPage: "products",
  orders: []
};

const API_BASE_URL = window.location.origin;
const productGrid = document.querySelector("#productGrid");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const cartDrawer = document.querySelector("#cartDrawer");
const drawerBackdrop = document.querySelector("#drawerBackdrop");
const cartItems = document.querySelector("#cartItems");
const cartEmpty = document.querySelector("#cartEmpty");
const cartFooter = document.querySelector("#cartFooter");
const toast = document.querySelector("#toast");
const adminDialog = document.querySelector("#adminDialog");
const adminLoginView = document.querySelector("#adminLoginView");
const adminPanel = document.querySelector("#adminPanel");
const adminProductList = document.querySelector("#adminProductList");
const adminOrderList = document.querySelector("#adminOrderList");
const themeToggle = document.querySelector("#themeToggle");
const checkoutSummary = document.querySelector("#checkoutSummary");
const trackDialog = document.querySelector("#trackDialog");
const trackOrderForm = document.querySelector("#trackOrderForm");
const trackUpdateForm = document.querySelector("#trackUpdateForm");
const trackLookupView = document.querySelector("#trackLookupView");
const trackDetailsView = document.querySelector("#trackDetailsView");
const trackOrderCard = document.querySelector("#trackOrderCard");
const trackStatusHeading = document.querySelector("#trackStatusHeading");
const DELIVERY_CHARGE = 15;
const ORDER_STATUSES = [
  ["new", "New"],
  ["preparing", "Preparing"],
  ["out-for-delivery", "Out for delivery"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"]
];
let toastTimeout;

function applyTheme(theme) {
  const selectedTheme = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = selectedTheme;
  const icon = themeToggle?.querySelector(".theme-toggle__icon");
  if (icon) icon.textContent = selectedTheme === "dark" ? "☾" : "☀";
  if (themeToggle) themeToggle.setAttribute("aria-label", selectedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  try {
    localStorage.setItem("smash-it-theme", selectedTheme);
  } catch (error) {
    // ignore storage failures for older browsers or restricted environments
  }
}

function toggleTheme() {
  const currentTheme = document.body.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

function renderCheckoutSummary() {
  if (!checkoutSummary) return;
  const entries = [...state.cart.entries()].map(([productId, quantity]) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return null;
    return { product, quantity };
  }).filter(Boolean);

  const subtotal = entries.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
  const itemCount = entries.reduce((sum, { quantity }) => sum + quantity, 0);
  const total = subtotal + (itemCount > 0 ? DELIVERY_CHARGE : 0);

  if (entries.length === 0) {
    checkoutSummary.innerHTML = '<p class="checkout-summary__item"><span>Your basket is empty</span><strong>₹0</strong></p>';
    return;
  }

  checkoutSummary.innerHTML = [
    ...entries.map(({ product, quantity }) => `
      <div class="checkout-summary__item">
        <span>${escapeHtml(product.name)} × ${quantity}</span>
        <strong>${formatPrice(product.price * quantity)}</strong>
      </div>
    `),
    '<div class="checkout-summary__item"><span>Delivery</span><strong>' + formatPrice(DELIVERY_CHARGE) + '</strong></div>',
    '<div class="checkout-summary__total"><span>Total</span><strong>' + formatPrice(total) + '</strong></div>'
  ].join("");
}

function formatOrderStatus(status) {
  const labels = {
    new: "New",
    preparing: "Preparing",
    "out-for-delivery": "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled"
  };
  return labels[status] || "Update soon";
}

function setTrackMessage(message, isError = false) {
  const element = document.querySelector("#trackMessage");
  if (!element) return;
  element.textContent = message;
  element.hidden = !message;
  element.setAttribute("role", isError ? "alert" : "status");
}

function setTrackUpdateMessage(message, isError = false) {
  const element = document.querySelector("#trackUpdateMessage");
  if (!element) return;
  element.textContent = message;
  element.hidden = !message;
  element.setAttribute("role", isError ? "alert" : "status");
}

async function lookupCustomerOrder(orderId, phone) {
  const result = await apiRequest("/orders/lookup", {
    method: "POST",
    body: JSON.stringify({ orderId, phone })
  });
  if (!result || typeof result.id !== "string") {
    throw new Error("We could not load this order.");
  }
  return result;
}

function renderTrackedOrder(order) {
  if (!order || !trackOrderCard || !trackStatusHeading) return;
  const itemList = order.items.map((item) => `
    <div class="track-order-card__row">
      <span>${escapeHtml(item.name)} × ${escapeHtml(item.quantity)}</span>
      <strong>${formatPrice(item.unitPrice * item.quantity)}</strong>
    </div>
  `).join("");

  trackStatusHeading.textContent = formatOrderStatus(order.status);
  trackOrderCard.innerHTML = `
    <div class="track-order-card__row"><span>Order number</span><strong>#${escapeHtml(order.id.slice(0, 8))}</strong></div>
    <div class="track-order-card__row"><span>Customer</span><strong>${escapeHtml(order.customer.name)}</strong></div>
    <div class="track-order-card__row"><span>Phone</span><strong>${escapeHtml(order.customer.phone)}</strong></div>
    <div class="track-order-card__row"><span>Address</span><strong>${escapeHtml(order.customer.address)}</strong></div>
    <div class="track-order-card__row"><span>Subtotal</span><strong>${formatPrice(order.subtotal)}</strong></div>
    <div class="track-order-card__row"><span>Delivery</span><strong>${formatPrice(order.deliveryCharge)}</strong></div>
    <div class="track-order-card__row"><span>Total</span><strong>${formatPrice(order.total)}</strong></div>
    <div class="track-order-card__row"><span>Items</span></div>
    ${itemList}
  `;
  document.querySelector("#trackEditName").value = order.customer.name;
  document.querySelector("#trackEditPhone").value = order.customer.phone;
  document.querySelector("#trackEditAddress").value = order.customer.address;
  const canEdit = order.status !== "delivered" && order.status !== "cancelled";
  document.querySelector("#trackEditName").disabled = !canEdit;
  document.querySelector("#trackEditPhone").disabled = !canEdit;
  document.querySelector("#trackEditAddress").disabled = !canEdit;
  document.querySelector("#cancelOrderButton").disabled = !canEdit;
}

function showTrackOrderDetails(order) {
  renderTrackedOrder(order);
  trackLookupView.hidden = true;
  trackDetailsView.hidden = false;
}

async function handleTrackLookup(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const orderId = formData.get("orderId").toString().trim();
  const phone = formData.get("phone").toString().trim();
  if (!orderId || !/^\d{10}$/.test(phone)) {
    setTrackMessage("Enter a valid order ID and 10-digit mobile number.", true);
    return;
  }

  try {
    setTrackMessage("Looking up your order…");
    const order = await lookupCustomerOrder(orderId, phone);
    showTrackOrderDetails(order);
    setTrackMessage("");
  } catch (error) {
    setTrackMessage(error.message, true);
  }
}

async function handleTrackOrderUpdate(event) {
  event.preventDefault();
  if (!trackDialog || trackDetailsView.hidden) return;
  const orderId = document.querySelector("#trackOrderId").value.trim();
  const phone = document.querySelector("#trackPhone").value.trim();
  if (!orderId || !/^\d{10}$/.test(phone)) {
    setTrackUpdateMessage("Use the saved order ID and mobile number to update your order.", true);
    return;
  }

  const formData = new FormData(event.currentTarget);
  const customer = {
    name: formData.get("name").toString().trim(),
    phone: formData.get("phone").toString().trim(),
    address: formData.get("address").toString().trim()
  };

  try {
    setTrackUpdateMessage("Saving your changes…");
    const result = await apiRequest(`/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      body: JSON.stringify({ phone, customer })
    });
    const refreshedOrder = await lookupCustomerOrder(orderId, customer.phone);
    showTrackOrderDetails(refreshedOrder);
    setTrackUpdateMessage(result.message || "Your order has been updated.");
  } catch (error) {
    setTrackUpdateMessage(error.message, true);
  }
}

async function handleCancelOrder() {
  const orderId = document.querySelector("#trackOrderId").value.trim();
  const phone = document.querySelector("#trackPhone").value.trim();
  if (!orderId || !/^\d{10}$/.test(phone)) {
    setTrackUpdateMessage("Use the saved order ID and mobile number to cancel the order.", true);
    return;
  }

  const confirmed = window.confirm("Cancel this order? This action cannot be undone.");
  if (!confirmed) return;

  try {
    setTrackUpdateMessage("Cancelling your order…");
    const result = await apiRequest(`/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      body: JSON.stringify({ phone, status: "cancelled" })
    });
    const refreshedOrder = await lookupCustomerOrder(orderId, phone);
    showTrackOrderDetails(refreshedOrder);
    setTrackUpdateMessage(result.message || "Your order has been cancelled.");
  } catch (error) {
    setTrackUpdateMessage(error.message, true);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

async function apiRequest(path, options = {}) {
  const headers = { Accept: "application/json", ...options.headers };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (state.adminToken) headers.Authorization = `Bearer ${state.adminToken}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (error) {
    const browserDetail = error instanceof Error && error.message ? ` (${error.message})` : "";
    const setupGuidance = window.location.protocol === "file:"
      ? " Open the storefront through an HTTP(S) web server and allow that site origin in API CORS."
      : " Check that the API is online and its CORS policy allows this site's origin, OPTIONS requests, and Authorization/Content-Type headers.";
    throw new Error(`Could not connect to ${API_BASE_URL}${path}${browserDetail}.${setupGuidance}`);
  }

  const responseText = await response.text();
  let result = null;
  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch (error) {
      const contentType = response.headers.get("content-type") || "unknown content type";
      throw new Error(
        `The shop API returned a non-JSON response (HTTP ${response.status}, ${contentType}). ` +
        "Open the storefront through the Smash It server and make sure this address also serves the API."
      );
    }
  }

  if (!response.ok) {
    if (response.status === 401 && state.adminToken) {
      state.adminToken = null;
      showAdminLogin("Your session expired. Please sign in again.");
    }
    const message = result && typeof result.message === "string" ? result.message : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return result;
}

async function uploadProductImage(file) {
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    throw new Error("Choose an image file for the product photo.");
  }
  const formData = new FormData();
  formData.append("image", file);
  const result = await apiRequest("/uploads/products", { method: "POST", body: formData });
  if (!result || typeof result.url !== "string" || !result.url.trim()) {
    throw new Error("The image upload API did not return an image URL.");
  }
  let imageUrl;
  try {
    imageUrl = new URL(result.url, API_BASE_URL);
  } catch (error) {
    throw new Error("The image upload API returned an invalid image URL.");
  }
  if (imageUrl.protocol !== "https:" && imageUrl.origin !== new URL(API_BASE_URL).origin) {
    throw new Error("The image upload API must return an HTTPS URL or a same-origin upload path.");
  }
  return imageUrl.origin === new URL(API_BASE_URL).origin ? `${imageUrl.pathname}${imageUrl.search}` : imageUrl.href;
}

function resolveProductImageUrl(imageUrl, fallback) {
  if (!imageUrl) return fallback;
  let resolvedUrl;
  try {
    resolvedUrl = new URL(imageUrl, API_BASE_URL);
  } catch (error) {
    throw new Error("The shop API returned an invalid product image URL.");
  }
  if (resolvedUrl.protocol !== "https:" && resolvedUrl.origin !== new URL(API_BASE_URL).origin) {
    throw new Error("Product image URLs must use secure HTTPS.");
  }
  return resolvedUrl.href;
}

function normalizeProduct(product) {
  if (!product || product.id === undefined || product.id === null || typeof product.name !== "string" || !product.name.trim()) {
    throw new Error("The shop API returned a product with missing information.");
  }
  const price = Number(product.price);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("The shop API returned a product with an invalid price.");
  }
  const previousPrice = product.previousPrice ?? null;
  const parsedPreviousPrice = previousPrice === null ? null : Number(previousPrice);

  const name = product.name.trim();
  const nameMatch = products.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  const fallbackImage = nameMatch?.image || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=700&q=80";
  const image = resolveProductImageUrl(product.imageUrl, fallbackImage);
  const normalizedName = name.toLocaleLowerCase();
  const category = product.category || nameMatch?.category || (
    /chicken|meat|fish|seafood|mutton|prawn|shrimp/.test(normalizedName) ? "Non-Veg" :
      /tomato|carrot|spinach|vegetable|potato|onion|pepper|broccoli|cucumber|lettuce/.test(normalizedName) ? "Vegetables" :
        /apple|avocado|strawberr|fruit|banana|mango|orange|grape/.test(normalizedName) ? "Fruits" :
          /milk|cheese|yogurt|dairy|butter/.test(normalizedName) ? "Dairy" : "Pantry"
  );

  return {
    id: String(product.id),
    name,
    category,
    weight: product.weight || nameMatch?.weight || "each",
    price,
    previousPrice: Number.isFinite(parsedPreviousPrice) ? parsedPreviousPrice : nameMatch?.previousPrice ?? null,
    rating: String(product.rating ?? nameMatch?.rating ?? "4.8"),
    badge: product.badge || nameMatch?.badge || "FRESH PICK",
    image,
    imageUrl: product.imageUrl ? image : null,
    imageAlt: product.imageAlt || nameMatch?.imageAlt || name
  };
}

async function refreshProducts() {
  const response = await apiRequest("/products");
  if (!Array.isArray(response)) throw new Error("The shop API product list must be an array.");
  const updatedProducts = response.map(normalizeProduct);
  products = updatedProducts;
  for (const productId of state.cart.keys()) {
    if (!products.some((product) => product.id === productId)) state.cart.delete(productId);
  }
  renderProducts();
  renderCart();
  renderAdminSummary();
  renderAdminProducts();
}

function formatPrice(price) {
  return `₹${price.toLocaleString("en-IN")}`;
}

function getVisibleProducts() {
  const searchTerm = state.search.trim().toLocaleLowerCase();
  const visible = products.filter((product) => {
    const matchesCategory = state.category === "All" || product.category === state.category;
    const matchesSearch = !searchTerm || `${product.name} ${product.category} ${product.weight}`.toLocaleLowerCase().includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

  if (state.sort === "price-asc") visible.sort((a, b) => a.price - b.price);
  if (state.sort === "price-desc") visible.sort((a, b) => b.price - a.price);
  if (state.sort === "rating") visible.sort((a, b) => Number(b.rating) - Number(a.rating));
  return visible;
}

function renderProducts() {
  const visibleProducts = getVisibleProducts();
  productGrid.innerHTML = visibleProducts.map((product) => `
    <article class="product-card">
      <div class="product-card__visual">
        <img class="product-card__image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.imageAlt)}" loading="lazy">
        <span class="product-badge">${escapeHtml(product.badge)}</span>
        <span class="product-rating"><span aria-hidden="true">★</span> ${escapeHtml(product.rating)}</span>
      </div>
      <div class="product-card__info">
        <p class="product-card__category">${escapeHtml(product.category)}</p>
        <div class="product-card__name-row">
          <h3 class="product-card__name">${escapeHtml(product.name)}</h3>
          <span class="product-card__weight">${escapeHtml(product.weight)}</span>
        </div>
        <div class="product-card__bottom">
          <span class="product-price">${formatPrice(product.price)}${product.previousPrice ? ` <del>${formatPrice(product.previousPrice)}</del>` : ""}</span>
          <button class="add-button" type="button" data-add="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)} to cart">+ Add</button>
        </div>
      </div>
    </article>
  `).join("");
  document.querySelector(".category-chip[data-category='All'] span").textContent = String(products.length).padStart(2, "0");
  emptyState.hidden = visibleProducts.length > 0;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2300);
}

function addToCart(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  state.cart.set(productId, (state.cart.get(productId) || 0) + 1);
  renderCart();
  showToast(`${product.name} added to your basket`);
}

function updateCartQuantity(productId, change) {
  const quantity = (state.cart.get(productId) || 0) + change;
  if (quantity <= 0) state.cart.delete(productId);
  else state.cart.set(productId, quantity);
  renderCart();
}

function renderCart() {
  const itemCount = [...state.cart.values()].reduce((total, quantity) => total + quantity, 0);
  const subtotal = products.reduce((total, product) => total + product.price * (state.cart.get(product.id) || 0), 0);
  const total = subtotal + (itemCount > 0 ? DELIVERY_CHARGE : 0);
  document.querySelector("#cartCount").textContent = itemCount;
  document.querySelector("#cartTrigger").setAttribute("aria-label", `Open cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`);
  document.querySelector("#drawerItemCount").textContent = `(${itemCount})`;
  document.querySelector("#cartSubtotal").textContent = formatPrice(subtotal);
  document.querySelector("#deliveryCharge").textContent = formatPrice(DELIVERY_CHARGE);
  document.querySelector("#cartTotal").textContent = formatPrice(total);
  cartEmpty.hidden = itemCount > 0;
  cartFooter.hidden = itemCount === 0;
  cartItems.innerHTML = products.filter((product) => state.cart.has(product.id)).map((product) => {
    const quantity = state.cart.get(product.id);
    return `
      <article class="cart-item">
        <img src="${escapeHtml(product.image)}" alt="">
        <div>
          <h3 class="cart-item__name">${escapeHtml(product.name)}</h3>
          <span class="cart-item__unit">${escapeHtml(product.weight)}</span>
          <div class="cart-item__price">${formatPrice(product.price * quantity)}</div>
        </div>
        <div class="quantity-control" aria-label="${escapeHtml(product.name)} quantity">
          <button type="button" data-quantity="${escapeHtml(product.id)}" data-change="-1" aria-label="Remove one ${escapeHtml(product.name)}">−</button>
          <span>${quantity}</span>
          <button type="button" data-quantity="${escapeHtml(product.id)}" data-change="1" aria-label="Add one ${escapeHtml(product.name)}">+</button>
        </div>
      </article>
    `;
  }).join("");
  renderCheckoutSummary();
}

function setAdminMessage(element, message, isError = false) {
  element.textContent = message;
  element.hidden = !message;
  element.setAttribute("role", isError ? "alert" : "status");
}

function showAdminLogin(message = "") {
  adminPanel.hidden = true;
  adminLoginView.hidden = false;
  setAdminMessage(document.querySelector("#adminLoginMessage"), message, Boolean(message));
}

function showAdminPanel() {
  adminLoginView.hidden = true;
  adminPanel.hidden = false;
  setAdminMessage(document.querySelector("#adminLoginMessage"), "");
  showAdminPage("products");
  renderAdminProducts();
}

function showAdminPage(page) {
  state.adminPage = page;
  const isOrdersPage = page === "orders";
  document.querySelector("#adminProductsPage").hidden = isOrdersPage;
  document.querySelector("#adminOrdersPage").hidden = !isOrdersPage;
  document.querySelector("#adminPanelTitle").textContent = isOrdersPage ? "Orders" : "Products";
  document.querySelector("#adminPanelIntro").textContent = isOrdersPage
    ? "Review customer details and update each order as you prepare and deliver it."
    : "Add product photos, change names or prices, and remove products from your shop.";
  document.querySelectorAll("[data-admin-page]").forEach((button) => {
    const isActive = button.dataset.adminPage === page;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderAdminSummary() {
  const productCount = document.querySelector("#adminProductCount");
  const orderCount = document.querySelector("#adminOrderCount");
  if (productCount) productCount.textContent = String(products.length);
  if (orderCount) orderCount.textContent = String(state.orders.length);
}

function renderAdminOrders() {
  if (!adminOrderList || adminPanel.hidden) return;
  if (state.orders.length === 0) {
    adminOrderList.innerHTML = '<p class="admin-empty">No orders yet. New customer orders will appear here.</p>';
    return;
  }
  adminOrderList.innerHTML = state.orders.map((order) => {
    const date = new Date(order.createdAt);
    const orderDate = Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString("en-IN");
    const items = order.items.map((item) => `
      <li>${escapeHtml(item.name)} × ${escapeHtml(item.quantity)} <span>${formatPrice(item.unitPrice * item.quantity)}</span></li>
    `).join("");
    const statusOptions = ORDER_STATUSES.map(([value, label]) =>
      `<option value="${value}"${order.status === value ? " selected" : ""}>${label}</option>`
    ).join("");
    return `
      <article class="admin-order-card" data-order-id="${escapeHtml(order.id)}">
        <div class="admin-order-card__heading">
          <div><strong>Order #${escapeHtml(order.id.slice(0, 8))}</strong><time>${escapeHtml(orderDate)}</time></div>
          <strong class="admin-order-total">${formatPrice(order.total)}</strong>
        </div>
        <div class="admin-order-customer">
          <strong>${escapeHtml(order.customer.name)}</strong>
          <a href="tel:${escapeHtml(order.customer.phone)}">${escapeHtml(order.customer.phone)}</a>
          <p>${escapeHtml(order.customer.address)}</p>
        </div>
        <ul class="admin-order-items">${items}</ul>
        <div class="admin-order-card__footer">
          <label>Order status
            <select data-order-status>${statusOptions}</select>
          </label>
          <button class="admin-row-button" type="button" data-order-action="save-status">Update status</button>
        </div>
      </article>
    `;
  }).join("");
}

async function loadAdminOrders() {
  adminOrderList.innerHTML = '<p class="admin-empty">Loading orders…</p>';
  try {
    const orders = await apiRequest("/orders");
    if (!Array.isArray(orders)) throw new Error("The order API did not return an order list.");
    state.orders = orders;
    renderAdminSummary();
    renderAdminOrders();
    setAdminMessage(document.querySelector("#adminPanelMessage"), "");
  } catch (error) {
    adminOrderList.innerHTML = "";
    setAdminMessage(document.querySelector("#adminPanelMessage"), `Orders could not be loaded: ${error.message}`, true);
  }
}

async function handleAdminOrderAction(event) {
  const button = event.target.closest('[data-order-action="save-status"]');
  if (!button) return;
  const row = button.closest("[data-order-id]");
  const orderId = row.dataset.orderId;
  const status = row.querySelector("[data-order-status]").value;
  button.disabled = true;
  try {
    const result = await apiRequest(`/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    const order = state.orders.find((entry) => entry.id === orderId);
    if (order) order.status = result.status;
    setAdminMessage(document.querySelector("#adminPanelMessage"), `Order #${orderId.slice(0, 8)} updated.`);
  } catch (error) {
    setAdminMessage(document.querySelector("#adminPanelMessage"), error.message, true);
  } finally {
    button.disabled = false;
  }
}

function renderAdminProducts() {
  renderAdminSummary();
  if (!adminProductList || adminPanel.hidden) return;
  if (products.length === 0) {
    adminProductList.innerHTML = '<p class="admin-empty">No products yet. Add your first product above.</p>';
    return;
  }

  adminProductList.innerHTML = products.map((product) => `
    <div class="admin-product-row" data-product-id="${escapeHtml(product.id)}">
      <label>Name
        <input data-field="name" value="${escapeHtml(product.name)}" maxlength="100" required>
      </label>
      <label>Price (₹)
        <input data-field="price" type="number" min="0.01" step="0.01" value="${escapeHtml(product.price)}" required>
      </label>
      <div class="admin-product-photo">
        <img src="${escapeHtml(product.image)}" alt="">
        <label>Replace photo (optional)
          <input data-field="image" type="file" accept="image/*">
        </label>
      </div>
      <button class="admin-row-button" type="button" data-admin-action="save">Save</button>
      <button class="admin-row-button admin-row-button--delete" type="button" data-admin-action="delete">Remove</button>
    </div>
  `).join("");
}

async function loadPublicCatalog() {
  try {
    await refreshProducts();
  } catch (error) {
    showToast(`Live catalog unavailable: ${error.message} Showing demo products.`);
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submitButton = form.querySelector('button[type="submit"]');
  const message = document.querySelector("#adminLoginMessage");
  const formData = new FormData(form);
  submitButton.disabled = true;
  setAdminMessage(message, "Signing in…");

  try {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email").trim(),
        password: formData.get("password")
      })
    });
    if (!result || typeof result.token !== "string" || !result.token) {
      throw new Error("The login API did not return a valid session token.");
    }
    state.adminToken = result.token;
    form.reset();
    showAdminPanel();
    setAdminMessage(document.querySelector("#adminPanelMessage"), "Signed in. Loading products…");
    try {
      await refreshProducts();
    } catch (error) {
      setAdminMessage(document.querySelector("#adminPanelMessage"), `Signed in, but products could not be loaded: ${error.message}`, true);
      return;
    }
    setAdminMessage(document.querySelector("#adminPanelMessage"), "");
  } catch (error) {
    state.adminToken = null;
    setAdminMessage(message, error.message, true);
  } finally {
    submitButton.disabled = false;
    document.querySelector("#adminPassword").value = "";
  }
}

async function handleAdminAdd(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const formData = new FormData(form);
  const name = formData.get("name").trim();
  const price = Number(formData.get("price"));
  const imageFile = formData.get("image");
  if (!name || !Number.isFinite(price) || price <= 0) {
    setAdminMessage(document.querySelector("#adminPanelMessage"), "Enter a product name and a price greater than zero.", true);
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const imageUrl = imageFile.size > 0 ? await uploadProductImage(imageFile) : null;
    const result = await apiRequest("/products", {
      method: "POST",
      body: JSON.stringify({ name, price, ...(imageUrl ? { imageUrl } : {}) })
    });
    if (result && result.id !== undefined) {
      products.push(normalizeProduct({
        ...result,
        name: result.name || name,
        price: result.price ?? price,
        ...(imageUrl ? { imageUrl } : {})
      }));
      renderProducts();
      renderCart();
      renderAdminProducts();
    } else {
      await refreshProducts();
    }
    form.reset();
    setAdminMessage(document.querySelector("#adminPanelMessage"), `${name} added.`);
  } catch (error) {
    setAdminMessage(document.querySelector("#adminPanelMessage"), error.message, true);
  } finally {
    submitButton.disabled = false;
  }
}

async function handleAdminProductAction(event) {
  const button = event.target.closest("[data-admin-action]");
  if (!button) return;
  const row = button.closest("[data-product-id]");
  const productId = row.dataset.productId;
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  if (button.dataset.adminAction === "delete") {
    if (!window.confirm(`Remove ${product.name} from the shop?`)) return;
    button.disabled = true;
    try {
      await apiRequest(`/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
      products = products.filter((item) => item.id !== productId);
      state.cart.delete(productId);
      renderProducts();
      renderCart();
      renderAdminProducts();
      setAdminMessage(document.querySelector("#adminPanelMessage"), `${product.name} removed.`);
    } catch (error) {
      button.disabled = false;
      setAdminMessage(document.querySelector("#adminPanelMessage"), error.message, true);
    }
    return;
  }

  const nameInput = row.querySelector('[data-field="name"]');
  const priceInput = row.querySelector('[data-field="price"]');
  const imageInput = row.querySelector('[data-field="image"]');
  if (!nameInput.reportValidity() || !priceInput.reportValidity()) return;
  const name = nameInput.value.trim();
  const price = Number(priceInput.value);
  if (!name || !Number.isFinite(price) || price <= 0) {
    setAdminMessage(document.querySelector("#adminPanelMessage"), "Enter a product name and a price greater than zero.", true);
    return;
  }

  button.disabled = true;
  try {
    const imageFile = imageInput.files[0];
    const imageUrl = imageFile ? await uploadProductImage(imageFile) : null;
    const result = await apiRequest(`/products/${encodeURIComponent(productId)}`, {
      method: "PUT",
      body: JSON.stringify({
        name,
        price,
        ...((imageUrl || product.imageUrl) ? { imageUrl: imageUrl || product.imageUrl } : {})
      })
    });
    const updated = normalizeProduct({
      ...product,
      ...(result && typeof result === "object" ? result : {}),
      id: productId,
      name,
      price,
      ...(imageUrl ? { imageUrl } : {})
    });
    products = products.map((item) => item.id === productId ? updated : item);
    renderProducts();
    renderCart();
    renderAdminProducts();
    setAdminMessage(document.querySelector("#adminPanelMessage"), `${name} saved.`);
  } catch (error) {
    button.disabled = false;
    setAdminMessage(document.querySelector("#adminPanelMessage"), error.message, true);
  }
}

function signOutAdmin() {
  state.adminToken = null;
  document.querySelector("#adminPassword").value = "";
  document.querySelector("#adminLoginForm").reset();
  setAdminMessage(document.querySelector("#adminPanelMessage"), "");
  showAdminLogin();
  document.querySelector("#adminEmail").value = "haseeb.darrr@gmail.com";
}

function openCart() {
  cartDrawer.classList.add("is-open");
  cartDrawer.setAttribute("aria-hidden", "false");
  drawerBackdrop.hidden = false;
  requestAnimationFrame(() => drawerBackdrop.classList.add("is-visible"));
  document.body.classList.add("no-scroll");
  renderCheckoutSummary();
  document.querySelector("#closeCart").focus();
}

function closeCart() {
  cartDrawer.classList.remove("is-open");
  cartDrawer.setAttribute("aria-hidden", "true");
  drawerBackdrop.classList.remove("is-visible");
  document.body.classList.remove("no-scroll");
  window.setTimeout(() => {
    if (!cartDrawer.classList.contains("is-open")) drawerBackdrop.hidden = true;
  }, 260);
  document.querySelector("#cartTrigger").focus();
}

document.querySelector("#categoryList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  document.querySelectorAll(".category-chip").forEach((chip) => {
    const isActive = chip === button;
    chip.classList.toggle("is-active", isActive);
    chip.setAttribute("aria-pressed", String(isActive));
  });
  renderProducts();
});

productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (button) addToCart(button.dataset.add);
});

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-quantity]");
  if (button) updateCartQuantity(button.dataset.quantity, Number(button.dataset.change));
});

searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  renderProducts();
});

sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value;
  renderProducts();
});

document.querySelector("#cartTrigger").addEventListener("click", openCart);
document.querySelector("#closeCart").addEventListener("click", closeCart);
document.querySelector("#startShopping").addEventListener("click", closeCart);
drawerBackdrop.addEventListener("click", closeCart);
document.querySelector("#openAdmin").addEventListener("click", () => {
  if (state.adminToken) showAdminPanel();
  else showAdminLogin();
  adminDialog.showModal();
  (state.adminToken ? document.querySelector("#adminPanelTitle") : document.querySelector("#adminEmail")).focus();
});
document.querySelector("#closeAdmin").addEventListener("click", () => adminDialog.close());
document.querySelector("#adminLoginForm").addEventListener("submit", handleAdminLogin);
document.querySelector("#adminAddForm").addEventListener("submit", handleAdminAdd);
adminProductList.addEventListener("click", handleAdminProductAction);
adminOrderList.addEventListener("click", handleAdminOrderAction);
document.querySelector(".admin-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-admin-page]");
  if (!button || button.dataset.adminPage === state.adminPage) return;
  showAdminPage(button.dataset.adminPage);
  if (state.adminPage === "orders") loadAdminOrders();
});
document.querySelector("#refreshOrders").addEventListener("click", loadAdminOrders);
document.querySelector("#adminLogout").addEventListener("click", signOutAdmin);
adminDialog.addEventListener("close", () => document.querySelector("#openAdmin").focus());
document.querySelector("#checkoutButton").addEventListener("click", () => {
  closeCart();
  renderCheckoutSummary();
  document.querySelector("#checkoutForm").reset();
  document.querySelector("#checkoutContent").hidden = false;
  document.querySelector("#checkoutSuccess").hidden = true;
  document.querySelector("#checkoutDialog").showModal();
  document.querySelector("#customerName").focus();
});

document.querySelector("#trackOrderButton").addEventListener("click", () => {
  trackOrderForm.reset();
  setTrackMessage("");
  setTrackUpdateMessage("");
  trackLookupView.hidden = false;
  trackDetailsView.hidden = true;
  trackDialog.showModal();
  document.querySelector("#trackOrderId").focus();
});
document.querySelector("#closeTrackDialog").addEventListener("click", () => trackDialog.close());
trackOrderForm.addEventListener("submit", handleTrackLookup);
trackUpdateForm.addEventListener("submit", handleTrackOrderUpdate);
document.querySelector("#cancelOrderButton").addEventListener("click", handleCancelOrder);
document.querySelector("#closeCheckout").addEventListener("click", () => document.querySelector("#checkoutDialog").close());
document.querySelector("#checkoutForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  if (state.cart.size === 0) {
    setAdminMessage(document.querySelector("#checkoutMessage"), "Your basket is empty.", true);
    return;
  }
  const formData = new FormData(event.currentTarget);
  const customerName = formData.get("customerName").trim();
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  const message = document.querySelector("#checkoutMessage");
  submitButton.disabled = true;
  setAdminMessage(message, "");
  try {
    const result = await apiRequest("/orders", {
      method: "POST",
      body: JSON.stringify({
        customer: {
          name: customerName,
          phone: formData.get("customerPhone").trim(),
          address: formData.get("customerAddress").trim()
        },
        items: [...state.cart.entries()].map(([productId, quantity]) => ({ productId, quantity }))
      })
    });
    if (!result || typeof result.id !== "string" || !Number.isFinite(Number(result.total))) {
      throw new Error("The shop API did not confirm your order.");
    }
    document.querySelector("#successMessage").textContent =
      `Thanks, ${customerName}! Order #${result.id.slice(0, 8)} is confirmed for ${formatPrice(Number(result.total))}. Online payment is not collected; arrange payment on delivery.`;
    state.cart.clear();
    renderCart();
    document.querySelector("#checkoutContent").hidden = true;
    document.querySelector("#checkoutSuccess").hidden = false;
    document.querySelector("#finishCheckout").focus();
  } catch (error) {
    setAdminMessage(message, `Your order could not be placed: ${error.message}`, true);
  } finally {
    submitButton.disabled = false;
  }
});
document.querySelector("#finishCheckout").addEventListener("click", () => document.querySelector("#checkoutDialog").close());
document.querySelector("#checkoutDialog").addEventListener("close", () => document.querySelector("#cartTrigger").focus());
if (themeToggle) {
  const storedTheme = (() => {
    try {
      return localStorage.getItem("smash-it-theme");
    } catch (error) {
      return null;
    }
  })();
  applyTheme(storedTheme === "dark" ? "dark" : "light");
  themeToggle.addEventListener("click", toggleTheme);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && cartDrawer.classList.contains("is-open")) closeCart();
});

document.querySelector("#year").textContent = new Date().getFullYear();
renderProducts();
renderCart();
loadPublicCatalog();

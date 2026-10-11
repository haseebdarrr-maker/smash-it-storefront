require("dotenv").config();

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const multer = require("multer");

const app = express();
const port = Number(process.env.PORT || 3000);
const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "";
const jwtSecret = process.env.JWT_SECRET || "";
const rootDirectory = __dirname;
const productsFile = path.join(rootDirectory, "data", "products.json");
const ordersFile = path.join(rootDirectory, "data", "orders.json");
const uploadsDirectory = path.join(rootDirectory, "public", "uploads", "products");
const orderStatuses = new Set(["new", "preparing", "out-for-delivery", "delivered", "cancelled"]);
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (request, file, callback) => {
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    if (!allowedTypes.has(file.mimetype)) {
      callback(new Error("Choose a JPEG, PNG, WebP, or GIF image."));
      return;
    }
    callback(null, true);
  }
});
const useGoogleCloudStorage = process.env.STORAGE_DRIVER === "google";
const storageBucketName = (process.env.FIREBASE_STORAGE_BUCKET || "").trim();

if (!adminEmail || !adminPassword || adminPassword.length < 12 || jwtSecret.length < 32) {
  console.error("Set ADMIN_EMAIL, an ADMIN_PASSWORD of at least 12 characters, and a JWT_SECRET of at least 32 characters.");
  process.exit(1);
}
if (useGoogleCloudStorage && !storageBucketName) {
  console.error("Set FIREBASE_STORAGE_BUCKET when STORAGE_DRIVER=google.");
  process.exit(1);
}

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"]
    }
  }
}));
app.use(express.json({ limit: "32kb" }));

function signToken(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", jwtSecret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireAdmin(request, response, next) {
  const authorization = request.get("authorization") || "";
  const match = authorization.match(/^Bearer ([A-Za-z0-9_.-]+)$/);
  if (!match) {
    response.status(401).json({ message: "Sign in to manage products." });
    return;
  }

  const [encodedPayload, providedSignature, extraPart] = match[1].split(".");
  if (!encodedPayload || !providedSignature || extraPart !== undefined) {
    response.status(401).json({ message: "Your admin session is invalid. Sign in again." });
    return;
  }
  const expectedSignature = crypto.createHmac("sha256", jwtSecret).update(encodedPayload).digest("base64url");
  if (!safeEqual(providedSignature, expectedSignature)) {
    response.status(401).json({ message: "Your admin session is invalid. Sign in again." });
    return;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (payload.sub !== adminEmail || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
      response.status(401).json({ message: "Your admin session has expired. Sign in again." });
      return;
    }
    request.admin = { email: payload.sub };
    next();
  } catch (error) {
    response.status(401).json({ message: "Your admin session is invalid. Sign in again." });
  }
}

let productsWriteQueue = Promise.resolve();
let ordersWriteQueue = Promise.resolve();

async function readProductsFile() {
  const contents = await fs.readFile(productsFile, "utf8");
  const products = JSON.parse(contents);
  if (!Array.isArray(products)) throw new Error("Product catalog must be a JSON array.");
  return products;
}

async function readProducts() {
  await productsWriteQueue;
  return readProductsFile();
}

let cloudStore = null;

function writeProductsFile(products) {
  const temporaryFile = `${productsFile}.${crypto.randomUUID()}.tmp`;
  return fs.writeFile(temporaryFile, `${JSON.stringify(products, null, 2)}\n`, "utf8")
    .then(async () => {
      try {
        await fs.rename(temporaryFile, productsFile);
      } catch (error) {
        if (process.platform !== "win32" || !["EPERM", "EEXIST"].includes(error.code)) throw error;
        await fs.rm(productsFile);
        await fs.rename(temporaryFile, productsFile);
      }
    })
    .catch(async (error) => {
      await fs.rm(temporaryFile, { force: true }).catch(() => {});
      throw error;
    });
}

function mutateProducts(mutator) {
  const operation = productsWriteQueue.then(async () => {
    const products = await readProductsFile();
    const result = await mutator(products);
    if (result.write) await writeProductsFile(products);
    return result;
  });
  productsWriteQueue = operation.catch(() => {});
  return operation;
}

async function readOrdersFile() {
  try {
    const contents = await fs.readFile(ordersFile, "utf8");
    const orders = JSON.parse(contents);
    if (!Array.isArray(orders)) throw new Error("Order storage must be a JSON array.");
    return orders;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function readOrders() {
  await ordersWriteQueue;
  return readOrdersFile();
}

async function writeOrdersFile(orders) {
  const temporaryFile = `${ordersFile}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryFile, `${JSON.stringify(orders, null, 2)}\n`, "utf8");
    try {
      await fs.rename(temporaryFile, ordersFile);
    } catch (error) {
      if (process.platform !== "win32" || !["EPERM", "EEXIST"].includes(error.code)) throw error;
      await fs.rm(ordersFile, { force: true });
      await fs.rename(temporaryFile, ordersFile);
    }
  } catch (error) {
    await fs.rm(temporaryFile, { force: true }).catch(() => {});
    throw error;
  }
}

function mutateOrders(mutator) {
  const operation = ordersWriteQueue.then(async () => {
    const orders = await readOrdersFile();
    const result = await mutator(orders);
    if (result.write) await writeOrdersFile(orders);
    return result;
  });
  ordersWriteQueue = operation.catch(() => {});
  return operation;
}

async function ensureOrdersFile() {
  try {
    await fs.writeFile(ordersFile, "[]\n", { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

function normalizeProductId(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return String(value);
  return "";
}

function validateProductInput(input, partial = false) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Provide product details as a JSON object." };
  }

  const result = {};
  if (!partial || Object.hasOwn(input, "name")) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100) {
      return { error: "Product name must be between 1 and 100 characters." };
    }
    result.name = input.name.trim();
  }
  if (!partial || Object.hasOwn(input, "price")) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) {
      return { error: "Product price must be greater than zero and no more than ₹1,000,000." };
    }
    result.price = price;
  }
  for (const field of ["category", "weight", "badge", "imageAlt"]) {
    if (Object.hasOwn(input, field)) {
      if (typeof input[field] !== "string" || input[field].length > 100) {
        return { error: `${field} must be text no longer than 100 characters.` };
      }
      result[field] = input[field].trim();
    }
  }
  if (Object.hasOwn(input, "previousPrice")) {
    const previousPrice = input.previousPrice === null ? null : Number(input.previousPrice);
    if (previousPrice !== null && (!Number.isFinite(previousPrice) || previousPrice < 0 || previousPrice > 1_000_000)) {
      return { error: "Previous price must be zero or greater." };
    }
    result.previousPrice = previousPrice;
  }
  if (Object.hasOwn(input, "imageUrl")) {
    if (input.imageUrl === null) {
      result.imageUrl = null;
    } else if (typeof input.imageUrl === "string" && /^\/uploads\/products\/[0-9a-f-]+\.(jpg|png|webp|gif)(\?.*)?$/i.test(input.imageUrl)) {
      result.imageUrl = input.imageUrl;
    } else if (typeof input.imageUrl === "string") {
      let imageUrl;
      try {
        imageUrl = new URL(input.imageUrl);
      } catch (error) {
        return { error: "Product image URL must be a valid HTTPS URL." };
      }
      if (imageUrl.protocol !== "https:") {
        return { error: "Product image URL must use HTTPS." };
      }
      result.imageUrl = imageUrl.href;
    } else {
      return { error: "Product image URL must be text." };
    }
  }
  return { value: result };
}

function hasValidImageSignature(file) {
  const bytes = file.buffer;
  if (file.mimetype === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === "image/gif") return ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"));
  if (file.mimetype === "image/webp") {
    return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

const loginAttempts = new Map();
const loginAttemptLimit = 10;
const loginWindowMs = 15 * 60 * 1000;

app.get("/health", (request, response) => response.json({ status: "ok" }));

app.post("/auth/login", (request, response) => {
  const now = Date.now();
  const key = request.ip;
  let attempts = loginAttempts.get(key);
  if (!attempts || attempts.resetAt <= now) {
    attempts = { count: 0, resetAt: now + loginWindowMs };
    loginAttempts.set(key, attempts);
  }
  if (attempts.count >= loginAttemptLimit) {
    response.status(429).json({ message: "Too many sign-in attempts. Please try again in 15 minutes." });
    return;
  }

  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  if (!safeEqual(email, adminEmail) || !safeEqual(password, adminPassword)) {
    attempts.count += 1;
    response.status(401).json({ message: "Email or password is incorrect." });
    return;
  }

  loginAttempts.delete(key);
  const token = signToken({ sub: adminEmail, exp: now + 8 * 60 * 60 * 1000 });
  response.json({ token, message: "Login successful" });
});

app.get("/products", async (request, response, next) => {
  try {
    response.json(cloudStore ? await cloudStore.getProducts() : await readProducts());
  } catch (error) {
    next(error);
  }
});

app.post("/orders", async (request, response, next) => {
  const customer = request.body?.customer;
  const items = request.body?.items;
  const name = typeof customer?.name === "string" ? customer.name.trim() : "";
  const phone = typeof customer?.phone === "string" ? customer.phone.trim() : "";
  const address = typeof customer?.address === "string" ? customer.address.trim() : "";
  if (!name || name.length > 100 || !/^\d{10}$/.test(phone) || !address || address.length > 500) {
    response.status(400).json({ message: "Enter a name, a 10-digit mobile number, and a delivery address of up to 500 characters." });
    return;
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    response.status(400).json({ message: "Add between 1 and 50 different products to your order." });
    return;
  }
  const quantities = new Map();
  for (const item of items) {
    const productId = normalizeProductId(item?.productId);
    if (!item || !productId ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 ||
      quantities.has(productId)) {
      response.status(400).json({ message: "Order items must have a product and a quantity between 1 and 99." });
      return;
    }
    quantities.set(productId, item.quantity);
  }

  try {
    const catalog = cloudStore ? await cloudStore.getProducts() : await readProducts();
    const orderItems = [];
    for (const [productId, quantity] of quantities) {
      const product = catalog.find((entry) => String(entry.id) === productId);
      if (!product) {
        response.status(400).json({ message: "A product in your basket is no longer available. Refresh the shop and try again." });
        return;
      }
      orderItems.push({
        productId,
        name: product.name,
        quantity,
        unitPrice: Number(product.price)
      });
    }
    const subtotal = Math.round(orderItems.reduce((total, item) => total + item.unitPrice * item.quantity, 0) * 100) / 100;
    const order = {
      id: crypto.randomUUID(),
      customer: { name, phone, address },
      items: orderItems,
      subtotal,
      deliveryCharge: 15,
      total: Math.round((subtotal + 15) * 100) / 100,
      status: "new",
      createdAt: new Date().toISOString()
    };
    const createdOrder = cloudStore
      ? await cloudStore.createOrder(order)
      : await mutateOrders(async (orders) => {
        orders.push(order);
        return { write: true, order };
      }).then((result) => result.order);
    response.status(201).json({
      id: createdOrder.id,
      total: createdOrder.total,
      status: createdOrder.status,
      message: "Order placed successfully"
    });
  } catch (error) {
    next(error);
  }
});

app.post("/orders/lookup", async (request, response, next) => {
  const orderId = typeof request.body?.orderId === "string" ? request.body.orderId.trim() : "";
  const phone = typeof request.body?.phone === "string" ? request.body.phone.trim() : "";
  if (!orderId || !/^\d{10}$/.test(phone)) {
    response.status(400).json({ message: "Provide the order ID and the mobile number used for the order." });
    return;
  }

  try {
    const orders = cloudStore ? await cloudStore.getOrders() : await readOrders();
    const order = orders.find((entry) => entry.id === orderId);
    if (!order) {
      response.status(404).json({ message: "We could not find an order with that ID." });
      return;
    }
    if (order.customer.phone !== phone) {
      response.status(404).json({ message: "The order ID and mobile number do not match." });
      return;
    }
    response.json(order);
  } catch (error) {
    next(error);
  }
});

app.patch("/orders/:id", async (request, response, next) => {
  const targetPhone = typeof request.body?.phone === "string" ? request.body.phone.trim() : "";
  const nextStatus = typeof request.body?.status === "string" ? request.body.status.trim() : "";
  const nextCustomer = request.body?.customer;
  const validPhone = /^\d{10}$/;

  if (!targetPhone || !validPhone.test(targetPhone)) {
    response.status(400).json({ message: "Provide the mobile number used for the order." });
    return;
  }

  try {
    const orders = cloudStore ? await cloudStore.getOrders() : await readOrders();
    const order = orders.find((entry) => entry.id === request.params.id);
    if (!order) {
      response.status(404).json({ message: "Order not found." });
      return;
    }
    if (order.customer.phone !== targetPhone) {
      response.status(401).json({ message: "The mobile number does not match this order." });
      return;
    }

    const updates = {};
    const nextName = typeof nextCustomer?.name === "string" ? nextCustomer.name.trim() : "";
    const nextAddress = typeof nextCustomer?.address === "string" ? nextCustomer.address.trim() : "";
    const nextPhone = typeof nextCustomer?.phone === "string" ? nextCustomer.phone.trim() : targetPhone;

    if (nextCustomer && typeof nextCustomer === "object") {
      if (!nextName || nextName.length > 100 || !nextAddress || nextAddress.length > 500 || !validPhone.test(nextPhone)) {
        response.status(400).json({ message: "Update the customer name, delivery address, and mobile number with valid details." });
        return;
      }
      updates.customer = { ...order.customer, name: nextName, address: nextAddress, phone: nextPhone };
    }

    if (nextStatus) {
      if (!orderStatuses.has(nextStatus)) {
        response.status(400).json({ message: "Choose a valid order status." });
        return;
      }
      if (nextStatus === "cancelled" && ["cancelled", "delivered"].includes(order.status)) {
        response.status(400).json({ message: "This order cannot be cancelled in its current state." });
        return;
      }
      updates.status = nextStatus;
    }

    if (Object.keys(updates).length === 0) {
      response.status(400).json({ message: "Choose an update for your order." });
      return;
    }

    const updatedOrder = cloudStore
      ? await cloudStore.updateOrder(request.params.id, updates)
      : await mutateOrders(async (orderList) => {
        const currentOrder = orderList.find((entry) => entry.id === request.params.id);
        if (!currentOrder) return { write: false, order: null };
        Object.assign(currentOrder, updates);
        return { write: true, order: currentOrder };
      }).then((result) => result.order);

    if (!updatedOrder) {
      response.status(404).json({ message: "Order not found." });
      return;
    }

    response.json({ id: updatedOrder.id, status: updatedOrder.status, message: "Your order has been updated." });
  } catch (error) {
    next(error);
  }
});

app.get("/orders", requireAdmin, async (request, response, next) => {
  try {
    const orders = cloudStore
      ? await cloudStore.getOrders()
      : (await readOrders()).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    response.json(orders);
  } catch (error) {
    next(error);
  }
});

app.patch("/orders/:id/status", requireAdmin, async (request, response, next) => {
  const status = request.body?.status;
  if (typeof status !== "string" || !orderStatuses.has(status)) {
    response.status(400).json({ message: "Choose a valid order status." });
    return;
  }
  try {
    const updatedOrder = cloudStore
      ? await cloudStore.updateOrderStatus(request.params.id, status)
      : await mutateOrders(async (orders) => {
        const order = orders.find((entry) => entry.id === request.params.id);
        if (!order) return { write: false, order: null };
        order.status = status;
        return { write: true, order };
      }).then((result) => result.order);
    if (!updatedOrder) {
      response.status(404).json({ message: "Order not found." });
      return;
    }
    response.json({ id: updatedOrder.id, status: updatedOrder.status, message: "Order status updated." });
  } catch (error) {
    next(error);
  }
});

app.post("/uploads/products", requireAdmin, imageUpload.single("image"), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ message: "Choose a product image to upload." });
      return;
    }
    if (!hasValidImageSignature(request.file)) {
      response.status(400).json({ message: "The selected file is not a valid supported image." });
      return;
    }
    const extensionByType = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif"
    };
    const filename = `${crypto.randomUUID()}${extensionByType[request.file.mimetype]}`;
    if (cloudStore) await cloudStore.saveImage(filename, request.file);
    else await fs.writeFile(path.join(uploadsDirectory, filename), request.file.buffer, { flag: "wx" });
    response.status(201).json({
      url: `/uploads/products/${filename}`,
      message: "Image uploaded successfully"
    });
  } catch (error) {
    next(error);
  }
});

app.get("/uploads/products/:filename", async (request, response, next) => {
  if (!/^[0-9a-f-]+\.(jpg|png|webp|gif)$/i.test(request.params.filename)) {
    response.status(404).end();
    return;
  }
  response.set("Cache-Control", "public, max-age=31536000, immutable");
  if (cloudStore) {
    try {
      if (!await cloudStore.imageExists(request.params.filename)) {
        response.status(404).end();
        return;
      }
      const contentTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
      response.type(contentTypes[path.extname(request.params.filename).slice(1).toLowerCase()]);
      const stream = cloudStore.createImageReadStream(request.params.filename);
      stream.on("error", next);
      stream.pipe(response);
    } catch (error) {
      next(error);
    }
    return;
  }
  response.sendFile(path.join(uploadsDirectory, request.params.filename), (error) => {
    if (error && !response.headersSent) next(error);
  });
});

app.post("/products", requireAdmin, async (request, response, next) => {
  const validation = validateProductInput(request.body);
  if (validation.error) {
    response.status(400).json({ message: validation.error });
    return;
  }
  try {
    let product;
    if (cloudStore) {
      product = await cloudStore.createProduct(validation.value);
    } else {
      const result = await mutateProducts(async (products) => {
        const nextProduct = {
          id: products.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1,
          ...validation.value
        };
        products.push(nextProduct);
        return { write: true, product: nextProduct };
      });
      product = result.product;
    }
    response.status(201).json({ ...product, message: "Product created successfully" });
  } catch (error) {
    next(error);
  }
});

app.put("/products/:id", requireAdmin, async (request, response, next) => {
  const validation = validateProductInput(request.body, true);
  if (validation.error) {
    response.status(400).json({ message: validation.error });
    return;
  }
  if (Object.keys(validation.value).length === 0) {
    response.status(400).json({ message: "Provide at least one product field to update." });
    return;
  }
  try {
    let product;
    if (cloudStore) {
      product = await cloudStore.updateProduct(request.params.id, validation.value);
    } else {
      const result = await mutateProducts(async (products) => {
        const index = products.findIndex((item) => String(item.id) === request.params.id);
        if (index === -1) return { write: false, product: null };
        products[index] = { ...products[index], ...validation.value };
        return { write: true, product: products[index] };
      });
      product = result.product;
    }
    if (!product) {
      response.status(404).json({ message: "Product not found." });
      return;
    }
    response.json({ ...product, message: "Product updated successfully" });
  } catch (error) {
    next(error);
  }
});

app.delete("/products/:id", requireAdmin, async (request, response, next) => {
  try {
    let deleted;
    if (cloudStore) {
      deleted = await cloudStore.deleteProduct(request.params.id);
    } else {
      const result = await mutateProducts(async (products) => {
        const index = products.findIndex((item) => String(item.id) === request.params.id);
        if (index === -1) return { write: false, deleted: false };
        products.splice(index, 1);
        return { write: true, deleted: true };
      });
      deleted = result.deleted;
    }
    if (!deleted) {
      response.status(404).json({ message: "Product not found." });
      return;
    }
    response.json({ message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
});

app.get("/", (request, response) => response.sendFile(path.join(rootDirectory, "index.html")));
app.get("/index.html", (request, response) => response.sendFile(path.join(rootDirectory, "index.html")));
app.get("/style.css", (request, response) => response.sendFile(path.join(rootDirectory, "style.css")));
app.get("/script.js", (request, response) => response.sendFile(path.join(rootDirectory, "script.js")));
app.use((request, response) => {
  response.status(404).json({ message: "Not found." });
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Product photos must be 5 MB or smaller."
      : "The image upload could not be processed.";
    response.status(400).json({ message });
    return;
  }
  if (error.message === "Choose a JPEG, PNG, WebP, or GIF image.") {
    response.status(400).json({ message: error.message });
    return;
  }
  console.error("Request failed:", error);
  response.status(500).json({ message: "The server could not complete the request." });
});

async function startServer() {
  await fs.mkdir(path.dirname(productsFile), { recursive: true });
  await ensureOrdersFile();
  await fs.mkdir(uploadsDirectory, { recursive: true });
  if (useGoogleCloudStorage) {
    const { CloudStore } = require("./cloud-store");
    cloudStore = new CloudStore(process.env.GOOGLE_CLOUD_PROJECT, storageBucketName);
    await cloudStore.initialize(await readProductsFile());
  }
  const server = app.listen(port, () => {
    console.log(`Smash It is running at http://localhost:${port}`);
  });
  server.on("error", (error) => {
    console.error("Could not start Smash It:", error);
    process.exitCode = 1;
  });
}

startServer().catch((error) => {
  console.error("Could not initialize the Smash It server:", error);
  process.exitCode = 1;
});

const { Firestore } = require("@google-cloud/firestore");
const { Storage } = require("@google-cloud/storage");

class CloudStore {
  constructor(projectId, bucketName) {
    this.firestore = new Firestore(projectId ? { projectId } : {});
    this.storage = new Storage(projectId ? { projectId } : {});
    this.bucket = this.storage.bucket(bucketName);
    this.products = this.firestore.collection("products");
    this.orders = this.firestore.collection("orders");
    this.metadata = this.firestore.collection("_metadata");
  }

  async initialize(seedProducts) {
    const catalogMarker = this.metadata.doc("catalog");
    await this.firestore.runTransaction(async (transaction) => {
      const marker = await transaction.get(catalogMarker);
      if (marker.exists) return;
      if (seedProducts.length > 490) throw new Error("The starter catalog is too large to initialize.");
      const existingProducts = await transaction.get(this.products);
      if (existingProducts.size > 0) {
        const nextOrder = existingProducts.docs.reduce((maxOrder, document) => {
          return Math.max(maxOrder, Number(document.data().sortOrder) + 1 || 0);
        }, 0);
        transaction.create(catalogMarker, { initializedAt: Date.now() });
        transaction.set(this.metadata.doc("sequence"), { nextOrder });
        return;
      }
      transaction.create(catalogMarker, { initializedAt: Date.now() });
      seedProducts.forEach((product, index) => {
        const { id, ...fields } = product;
        transaction.create(this.products.doc(String(id)), { ...fields, sortOrder: index });
      });
      transaction.create(this.metadata.doc("sequence"), { nextOrder: seedProducts.length });
    });
  }

  async getProducts() {
    const snapshot = await this.products.orderBy("sortOrder", "asc").get();
    return snapshot.docs.map((document) => this.toProduct(document));
  }

  async createProduct(fields) {
    const productReference = this.products.doc();
    const sequenceReference = this.metadata.doc("sequence");
    return this.firestore.runTransaction(async (transaction) => {
      const sequence = await transaction.get(sequenceReference);
      const sortOrder = sequence.exists ? sequence.data().nextOrder : 0;
      transaction.set(sequenceReference, { nextOrder: sortOrder + 1 });
      const product = { id: productReference.id, ...fields, sortOrder };
      transaction.create(productReference, product);
      return product;
    });
  }

  async updateProduct(id, fields) {
    const reference = this.products.doc(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return null;
      transaction.update(reference, fields);
      return this.toProduct(snapshot, fields);
    });
  }

  async deleteProduct(id) {
    const reference = this.products.doc(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return false;
      transaction.delete(reference);
      return true;
    });
  }

  async createOrder(order) {
    await this.orders.doc(order.id).create(order);
    return order;
  }

  async getOrders() {
    const snapshot = await this.orders.orderBy("createdAt", "desc").get();
    return snapshot.docs.map((document) => ({ ...document.data(), id: document.id }));
  }

  async updateOrder(id, updates) {
    const reference = this.orders.doc(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return null;
      transaction.update(reference, updates);
      return { ...snapshot.data(), ...updates, id: snapshot.id };
    });
  }

  async updateOrderStatus(id, status) {
    const reference = this.orders.doc(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return null;
      transaction.update(reference, { status });
      return { ...snapshot.data(), id: snapshot.id, status };
    });
  }

  async saveImage(filename, file) {
    await this.bucket.file(filename).save(file.buffer, {
      resumable: false,
      validation: "crc32c",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: file.mimetype }
    });
  }

  async imageExists(filename) {
    const [exists] = await this.bucket.file(filename).exists();
    return exists;
  }

  createImageReadStream(filename) {
    return this.bucket.file(filename).createReadStream();
  }

  toProduct(snapshot, updates = {}) {
    const { sortOrder, ...fields } = snapshot.data();
    return { ...fields, ...updates, id: snapshot.id };
  }
}

module.exports = { CloudStore };

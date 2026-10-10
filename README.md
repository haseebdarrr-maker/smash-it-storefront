# Smash It

## Run locally

Install Node.js 22 or newer, then from this folder run:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` and set the admin email, a new strong password (at least 12 characters), and a unique random JWT secret (at least 32 characters). Do not reuse a password shared in chat or commit `.env`.

The starter catalog is loaded from `data/products.json`. In local mode, product changes and uploaded photos are saved on disk. Customer orders are saved privately in the ignored file `data/orders.json` and can be reviewed from **Admin login → Orders**. Back up this file securely if you need to retain local orders.

Generate a signing secret in PowerShell after installing Node.js:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Start the site and API together:

```powershell
npm start
```

Open `http://localhost:3000`. Do not open `index.html` directly from the file system; serving the storefront and API from one origin avoids browser CORS issues.

## Public demo on Render's free plan

This Blueprint deploys the Node.js shop as a public web service in Render's Singapore region. It uses local file storage, so **do not rely on it for real customer orders**: free services sleep when idle and have an ephemeral filesystem. Orders, product changes, and uploaded photos can be lost whenever the service sleeps, restarts, or is redeployed. The free service can also take about a minute to wake for the first customer after idle time.

1. Put the project in a **private** GitHub repository and connect that repository to a Render account. Do not upload `.env`, `node_modules`, or customer-order data.
2. In Render, create a new **Blueprint** from the connected repository and deploy the `render.yaml` configuration. Select the Free plan; do not add a paid instance or disk.
3. When prompted for Blueprint environment variables, enter `ADMIN_EMAIL`, set a new strong `ADMIN_PASSWORD` that has never been shared in chat, and provide a unique random `JWT_SECRET` of at least 32 characters. Keep these values in Render's environment-variable settings, not in the repository.
4. After the `/health` check passes, open the service's public `onrender.com` URL. The store and its admin login use that same public address.

Free plans have quotas and limitations and are intended for demos, not production order handling. Review [Render's free-instance limitations](https://render.com/docs/free) before deploying. For real orders, use durable database and image storage instead of the local-file demo configuration described here.

## Deploy on Google Cloud Run

Cloud Run uses Firestore for durable product data and a private Cloud Storage bucket for uploaded product photos. The API serves photo files from the same origin as the storefront. Do not use the local JSON/file mode for a deployed Cloud Run service: its local filesystem is temporary.

1. Create a Google Cloud project, attach a billing account, install the Google Cloud CLI, and sign in:

   ```powershell
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. In PowerShell, set your project and select a region close to your customers. Keep Firestore, the storage bucket, and Cloud Run in the same region:

   ```powershell
   $ProjectId = "YOUR_PROJECT_ID"
   $Region = "us-central1"
   $Bucket = "$ProjectId-smash-it-products"
   $ServiceAccount = "smash-it-runtime@$ProjectId.iam.gserviceaccount.com"
   ```

   Storage bucket names must be globally unique. If that bucket name is taken, choose another unique name.

3. Enable the required services, create the native Firestore database, storage bucket, and runtime service account:

   ```powershell
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com storage.googleapis.com secretmanager.googleapis.com --project $ProjectId
   gcloud firestore databases create --database="(default)" --location=$Region --type=firestore-native --project $ProjectId
   gcloud storage buckets create "gs://$Bucket" --location=$Region --uniform-bucket-level-access --project $ProjectId
   gcloud iam service-accounts create smash-it-runtime --display-name="Smash It Cloud Run runtime" --project $ProjectId
   gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$ServiceAccount" --role="roles/datastore.user"
   gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$ServiceAccount" --role="roles/storage.objectUser"
   ```

4. In Google Cloud Console, create these three Secret Manager secrets and add secret versions. Use a new admin password of at least 12 characters; do not reuse a password shared in chat. Generate a separate JWT signing secret with the Node.js command in the local setup section.

   - `smash-it-admin-email`
   - `smash-it-admin-password`
   - `smash-it-jwt-secret`

   Grant the Cloud Run service account access to those secrets:

   ```powershell
   gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$ServiceAccount" --role="roles/secretmanager.secretAccessor"
   ```

5. From the project folder, deploy the app:

   ```powershell
   gcloud run deploy smash-it `
     --source . `
     --project $ProjectId `
     --region $Region `
     --service-account $ServiceAccount `
     --allow-unauthenticated `
     --set-env-vars "STORAGE_DRIVER=google,GOOGLE_CLOUD_PROJECT=$ProjectId,FIREBASE_STORAGE_BUCKET=$Bucket" `
     --set-secrets "ADMIN_EMAIL=smash-it-admin-email:latest,ADMIN_PASSWORD=smash-it-admin-password:latest,JWT_SECRET=smash-it-jwt-secret:latest"
   ```

6. Open the HTTPS service URL printed by Cloud Run. The public shop is available without signing in; product changes and photo uploads require the admin login.

Cloud Run, Firestore, Cloud Storage, builds, and network use may incur charges. Review Google Cloud pricing and configure a budget alert before deploying. The app has no cross-origin API calls when served from its Cloud Run URL.

## API

- `GET /health` — server health check.
- `POST /auth/login` — accepts `{ "email": "...", "password": "..." }`.
- `GET /products` — public product catalog.
- `POST /orders` — places an order using current catalog prices; online payment is not collected.
- `GET /orders` — lists customer orders; requires admin authorization.
- `PATCH /orders/:id/status` — updates an order status; requires admin authorization.
- `POST /products` — creates a product; requires `Authorization: Bearer <token>`.
- `PUT /products/:id` — updates product name, price, and image URL; requires admin authorization.
- `DELETE /products/:id` — removes a product; requires admin authorization.
- `POST /uploads/products` — accepts multipart form data with an `image` file; requires admin authorization and returns `{ "url": "..." }`.

In local mode, product data is stored in `data/products.json`, orders in the private `data/orders.json`, and uploaded images in `public/uploads/products/`. In Google Cloud mode, product and order records live in Firestore and product images in Cloud Storage.

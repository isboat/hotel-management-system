# Hotel Management web application

A responsive React and TypeScript staff workspace built with Vite. The available screens depend on the signed-in role and selected property. The interface adapts its navigation and room and record layouts for phones, tablets, and laptops.

## Local development

Install Node.js 24 and start the API following the backend README. From `frontend/`, run the following.

```sh
npm ci
npm run dev
```

The API defaults to `http://localhost:5080`. Set `VITE_API_URL` in `.env.local` to use a different API origin. It is a public build setting. Set the backend's `FrontendOrigins__0` to match the frontend origin when changing the Vite host or port.

Start by signing in as the bootstrapped system administrator, creating a hotel tenant, and assigning its property administrator. Sign in as the property administrator to add rooms and staff. Open a cash shift in **Cash desk** before recording cash on a guest folio.

## Checks

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Vitest tests cash conversion and validation. Playwright runs the staff sign-in and room inventory flow at laptop, tablet, and mobile sizes with a mocked API. Backend integration tests cover actual API persistence and permission checks.

## Azure Static Web Apps

Create the Static Web App and set `VITE_API_URL` as a repository variable for the frontend build, using the API's HTTPS origin. Store the deployment token in the GitHub `frontend-production` environment as `AZURE_STATIC_WEB_APPS_API_TOKEN`. Add the Static Web App's origin to the API's allowed origins.

The frontend build workflow tests the app and uploads `dist/`. The separate deployment workflow deploys the artifact from the successful `main` build. Vite copies `public/staticwebapp.config.json` into the artifact for client-side navigation fallback.

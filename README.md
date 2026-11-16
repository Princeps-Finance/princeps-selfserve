# Princeps Self Service

Angular 21 frontend for Princeps salary loan applications. The browser calls the documented self service v2 API directly.

```bash
npm ci
npm start
npm run test:ci
npm run build
```

Local development uses the public backend origin in `.env.development`. For a hosted build, set `NG_APP_API_BASE_URL` in the build environment. Set environment overrides in an ignored local env file. Use only public frontend configuration; never put credentials or tokens in an env file consumed by the builder.

See [API integration and release instructions](docs/api/integration.md) for the journey, data retention, OpenAPI generation, and deployment.

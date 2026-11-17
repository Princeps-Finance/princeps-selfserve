# Amplify Hosting

Connect the GitHub repository and the `development` branch to Amplify Hosting. Select Node 22 in Amplify's build image settings. The root `amplify.yml` installs dependencies and builds the static Angular site.

Set `NG_APP_API_BASE_URL` to the backend HTTPS origin in Amplify's environment variables. The development origin is `https://self-service-apply.princeps.cloud`. Set `NG_APP_ACCOUNTS_URL` if the welcome screen should link to an accounts site. Amplify passes these public values to ngx-env during the build. Redeploy after changing a value.

Set `NODE_AUTH_TOKEN` as a build secret with read access to the private `@princeps-finance/ui` package. Keep this value out of `NG_APP_*` settings. For GitHub Actions builds, grant this repository read access under the package’s **Manage Actions access** settings.

Add `200` rewrites from `/apply` and `/apply/<*>` to `/index.html`. The root `customHttp.yml` sets cache and security headers. The development API is already listed in its `connect-src`. For another API or signed upload host, set the matching origins in the hosting policy. The backend must allow the Amplify site origin through CORS.

# GitHub Pages Deployment

Certamen is ready to deploy as a static GitHub Pages app.

## What The Workflow Does

The workflow in `.github/workflows/deploy-pages.yml`:

- runs on pushes to `main`;
- installs dependencies with `npm ci`;
- detects the correct Vite base path;
- runs `npm run build:pages`;
- copies `dist/index.html` to `dist/404.html` for SPA fallback routes;
- adds `dist/.nojekyll`;
- uploads `dist/` as a GitHub Pages artifact;
- deploys it with GitHub's official Pages actions.

## Supported Repository Shapes

For a normal project repository:

```text
https://github.com/<user-or-org>/certamen
https://<user-or-org>.github.io/certamen/
```

the workflow builds with:

```text
VITE_BASE_PATH=/certamen/
```

For a user or organization Pages repository:

```text
https://github.com/<user-or-org>/<user-or-org>.github.io
https://<user-or-org>.github.io/
```

the workflow builds with:

```text
VITE_BASE_PATH=/
```

## Local Test

To test the GitHub Pages build locally with a project-style base path:

```bash
VITE_BASE_PATH=/certamen/ npm run build:pages
npm run preview
```

On PowerShell:

```powershell
$env:VITE_BASE_PATH = "/certamen/"
npm run build:pages
Remove-Item Env:VITE_BASE_PATH
npm run preview
```

## GitHub Repository Setting

In the GitHub repository:

1. Open `Settings`.
2. Open `Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Push to `main`.
5. Open the `Actions` tab and wait for `Deploy GitHub Pages`.

After the workflow succeeds, GitHub shows the live Pages URL in the deployment summary and in `Settings -> Pages`.

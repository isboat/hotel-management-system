# PremaDesk marketing site

This standalone single-page site uses HTML, CSS, and JavaScript. The operational PremaDesk application has its own deployment.

## Preview locally

From the repository root, run `python3 -m http.server 8080 --directory marketing-site` and open `http://localhost:8080`.

To test the contact form with an email client, temporarily set `window.PREMADESK_CONTACT_EMAIL` in `site-config.js` to a test inbox. With an empty address, the form downloads the request as a text draft. With an address, it opens an email draft for the visitor to review and send. The site does not collect or store submissions.

## Deploy to Azure Static Web Apps

1. Create a separate Azure Static Web Apps resource for the marketing site. Choose **Other** as the deployment source to use the workflow already in this repository.
2. In the resource, open **Manage deployment token** and copy its token.
3. In GitHub, open **Settings**, then **Environments**, and create `marketing-production`.
4. Add the token as the environment secret `MARKETING_AZURE_STATIC_WEB_APPS_API_TOKEN`.
5. Add the public inbox for demo requests as the environment variable `MARKETING_CONTACT_EMAIL`. The workflow requires a valid email before uploading the site.
6. Merge the site and workflow to `main`. The workflow deploys when marketing files change on `main`. You can also run **Marketing site deploy to Azure Static Web Apps** manually from `main`.
7. Open the URL shown in the Azure resource. Submit a test demo request and verify that the draft is addressed to your inbox.

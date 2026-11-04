# FUDY product catalogue

A fast, free website for browsing FUDY products: prices, original prices, offers, stock and where to
pick things up. There is no cart or checkout. Visitors explore, then come to your stock point.

It runs on **GitHub Pages** (free). There is no server and no database. The products live in two
files in this repository, and a small **owner admin** inside the site edits those files for you.

```
docs/                     <- the live website (GitHub Pages serves this folder)
  index.html, app.js, styles.css
  data/products.json      <- all products
  data/settings.json      <- store name, address, phone, stock settings, gallery
  images/products/        <- product photos (added by the admin)
  images/gallery/         <- gallery photos (added by the admin)
src/                      <- source code (only needed if you change the design)
scripts/                  <- helper scripts (preview, demo data, test helper)
```

## Set up (about 15 minutes, one time)

**1. Put the files on GitHub.**
Create a **public** repository (for example `fudy-site`). Upload everything from this folder
(on github.com: Add file, Upload files, drag the folders in). Keep the folder names as they are.

**2. Turn on GitHub Pages.**
Repository, Settings, Pages. Under "Build and deployment" choose **Deploy from a branch**, pick the
`main` branch and the folder **/docs**, then Save. After a minute your site is live at
`https://YOUR-USERNAME.github.io/fudy-site/`.

**3. Make your owner token (your private key to edit the site).**
GitHub, click your picture, Settings, Developer settings, Personal access tokens, **Fine-grained tokens**,
Generate new token.
- Name: `FUDY admin`. Expiration: the longest you are offered.
- Repository access: **Only select repositories**, choose your `fudy-site`.
- Permissions, Repository permissions: **Contents: Read and write**. Nothing else.
- Generate token and copy it. GitHub shows it only once. Keep it private.

**4. Sign in to the admin.**
Open `https://YOUR-USERNAME.github.io/fudy-site/#/admin` (or the "Owner login" link in the footer).
Enter `YOUR-USERNAME/fudy-site` and the token. The token stays in your browser and only goes to GitHub.
If you ever lose it, delete it on GitHub and make a new one.

**5. Activate the contact form (once).**
The contact form emails `fudy.contact@gmail.com` through the free service FormSubmit.
The first time anyone sends a message, FormSubmit emails that inbox an activation link.
Click it once. Send a test message from your own site to make sure it arrives.

## Everyday use

In the admin, add or edit products, change stock with the plus and minus buttons, set a selling
price with a higher original price to show a discount, add an offer line and an end date, and
upload photos. Press **Publish changes**. The site updates in about 1 to 2 minutes.

- An offer with an end date switches itself off after that day and the original price comes back.
- Photos are shrunk automatically before upload.
- Remove a product with Delete, or Hide it to keep it saved but off the site.
- "Store details" holds the address, hours, phone, WhatsApp number, FSSAI number and social links.
  The WhatsApp button and the FSSAI line only appear once you fill them in.
- Keep stock honest. Visitors plan a trip to your stock point from these numbers.

## Change the design (optional)

Needs Node 18 or newer.

    npm install
    npm run build          # rebuilds docs/app.js and docs/styles.css, never touches your data
    npm run serve          # preview at http://localhost:8080

`npm run seed` rewrites the demo products and **overwrites your data**. Do not run it after you go live.

## Good to know

- Free GitHub Pages needs a public repository, so the product data and photos are public. That is
  fine for a catalogue. Never put private information in the repository.
- Website addresses look like `.../#/products`. This keeps it working on any free host.
- Several people editing at the same time can conflict. The admin detects this and asks you to reload.
- Everything shown as a placeholder (address, phone, FSSAI, about text, demo products) is for you to replace.
- Selling food normally needs an FSSAI license. Add the number in Store details once you have it.

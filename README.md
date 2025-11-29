# BeaedCorpusExpress
Web Design custom product

-------------------------------------------

Descriptions:

Users: End Users accessing the site.

Business: Client

Proof of Product: Realized image of product with dimensions, palette, and specifications. Artwork POC.

-------------------------------------------

Client specifications:

Users must be able to select and design custom products from a select number of tags and regulated templates. (Design)

Users must be able to login into the application to access previous orders. (Authz)

Users must be able to access account information. (Database Storage and Auth/Authz)

The Business must receive completed order invoices with design selections in PDF format directly to Client. (Structure)

The Business must be able to access an order logbook with unique identifiers for each customer in the event a customer order is misplaced/lost. (Database Storage)

User must receive a finalized proof of product prior to payment portal. Also store in user account information and send to user account email.

The files sent to the Business must be translatable into PDF.

-------------------------------------------

Tentative requirements, likely to be fulfilled by Stripe POS:

Users must be able to pay online using a portal hosted by the Business.

## Backend/API (added)

A lightweight Node/Express API now backs authentication and order history.

- Tech: Express, cookie-based sessions, bcryptjs for hashing, JSON file storage at `server/data/db.json`.
- API routes (all JSON, with credentials/cookies):
  - `GET /api/session` - current user (if signed in)
  - `POST /api/signup` - `{ email, password }`
  - `POST /api/login` - `{ email, password }` (accepts temp passwords, marks `passwordChangeRequired`)
  - `POST /api/logout`
  - `POST /api/password/reset` - `{ email }` (generates temp password, logs it to server console for now)
  - `POST /api/password/update` - `{ newPassword }` (requires auth)
  - `GET /api/orders` - list orders for the signed-in user
  - `POST /api/orders` - `{ order }` to save custom/stock orders

### Run locally

```bash
npm install
npm run dev    # starts server at http://localhost:3000 serving the static site + API
```

### Notes

- Reset emails are logged to the server console until SMTP credentials are added.
- Sessions are stored in `server/data/db.json`; delete this file to clear all users/sessions.
- Frontend now calls the API (with cookies) for login/signup/reset and order saving; localStorage auth was removed.

# GitHub Pages + Docker + Cloudflare Tunnel

## Local HTTP

Keep `SESSION_COOKIE_SECURE=false`, `SESSION_COOKIE_SAMESITE=lax`, `TRUST_PROXY=0`.
The existing SQL container and `sqlserver_data` volume stay outside Compose.
Backend stays on `127.0.0.1:3000`; do not publish SQL or backend on all interfaces.
The tunnel is opt-in via the `tunnel` Compose profile.

## Public API

In the untracked `.env`, preserve existing DB credentials and SESSION_SECRET and set:

```dotenv
APP_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://nguyenhoangphuc1711.github.io
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=none
TRUST_PROXY=172.30.251.2
CLOUDFLARE_TUNNEL_TOKEN=placeholder
```

Replace only the tunnel placeholder with the real token locally. Never paste it into
commands, screenshots, frontend source or Git. Do not run `docker compose config`
without `--quiet`: rendered configuration includes secrets.

Configure the named tunnel's public hostname in Cloudflare:
`api.puckin.id.vn` → HTTP service `http://backend:3000`.
Do not use localhost in the tunnel container. Cloudflared has fixed IP `172.30.251.2`
and backend has fixed IP `172.30.251.3` on the dedicated `172.30.251.0/29` network.
Both services have explicit addresses to prevent Docker assigning the proxy address
to backend. Backend also stays connected to external `endlessshop_network` for SQL.
Only the cloudflared address is trusted for
forwarded HTTPS and `CF-Connecting-IP`; rate limits normalize IPv6 /56 prefixes.
If this subnet overlaps another local/VPN network, change the subnet/address in
[compose.yaml](./compose.yaml) and TRUST_PROXY together before starting.
Legacy TRUST_PROXY=1 maps to this exact address, not arbitrary one-hop trust.
Keep Cloudflare Pseudo IPv4 disabled or in Add Header mode to retain real visitor IPs.

```powershell
docker compose --profile tunnel config --quiet
docker compose up -d --build --no-deps backend
docker compose --profile tunnel up -d cloudflared
```

The last command starts the real tunnel; run it only after configuring the hostname.
Enable Docker Desktop startup at Windows sign-in. `unless-stopped` takes effect when
the Docker engine is running and the container was not manually stopped.

Public mode still allows direct HTTP localhost login: requests with a localhost/
127.0.0.1 Host and no proxy headers receive a Lax, non-Secure cookie. HTTPS tunnel
requests always use configured None/Secure cookies. HTTP hosts other than localhost
have no such exception. Keep localhost in APP_ORIGINS.

## Frontend publication

[config.js](./web-ban-quan-ao/js/config.js) automatically chooses
`https://api.puckin.id.vn` on `https://nguyenhoangphuc1711.github.io`; other origins
default to the same origin (`API_BASE=''`). Edit only its `API_BASE` expression to
override that decision. It contains no secrets. Every HTML page loads it first.

```powershell
powershell -NoProfile -File ./scripts/export-pages.ps1
```

The generated, Git-ignored [pages/](./pages/) is the standalone publish directory.
Its root contains exactly the five HTML pages plus `css/`, `js/`, `img/`.
Images come from the Pages origin; legacy DB image paths are mapped to `img/` under
the current page directory, including `/EndLessShop/`. No API or SQL is copied.
Export copies current files without deleting older output: use the explicit copy
list below and review the target diff if files were removed or renamed later.

The local Git remote is a different repository. Do not push it to update Pages.
Clone the actual Pages repo into a separate chosen directory, then copy only:

- `pages/index.html`, `pages/checkout.html`, `pages/account.html`,
  `pages/login.html`, `pages/register.html` to its root.
- Entire `pages/css/`, `pages/js/`, `pages/img/` into matching root directories.

For a fresh clone without replacing the current workspace (choose the destination):

```powershell
git clone https://github.com/nguyenhoangphuc1711/EndLessShop.git <chosen-directory>
# Copy the public files above, then enter that clone.
git status --short
git diff --check
git diff --stat
git add -- index.html checkout.html account.html login.html register.html css js img
git diff --cached --stat
git commit -m "Connect storefront to Cloudflare API"
# Check Pages Settings for its actual deployment branch and source folder.
git push origin HEAD:<actual-Pages-branch>
```

These are manual suggestions, not commands executed by the agent. If Pages publishes
a subfolder instead of the branch root, place the same contents in that source folder.
Do not copy `.env`, server/, Compose, Dockerfile or reference documents to Pages.
No deployment workflow is added or required by this change.

## Read-only checks

```powershell
docker compose config --quiet
docker compose exec -T backend node scripts/verify-connection.js
curl.exe -i http://localhost:3000/api/health
curl.exe -i -X OPTIONS http://localhost:3000/api/orders -H "Origin: https://nguyenhoangphuc1711.github.io" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type,x-csrf-token,idempotency-key"
curl.exe -i -X OPTIONS http://localhost:3000/api/orders -H "Origin: https://foreign.example" -H "Access-Control-Request-Method: POST"
curl.exe -i http://localhost:3000/api/products -H "Origin: https://nguyenhoangphuc1711.github.io"
```

The connection regression script uses in-memory session/DB substitutes only; it
never connects to SQL or creates real accounts/orders. Other auth/order verification
scripts may write data or restart services and require separate authorization.

Quote limits: 60/account/minute and 120/IP/minute. Create limits: 10/account/15 minutes
and 30/IP/15 minutes; requests including idempotent retries count. Counters are in
memory and reset at restart. CORS does not replace authentication or CSRF.

Third-party cookie blocking can still prevent login even with None/Secure. If login
returns success but the immediate profile request returns 401, the UI explains how
to allow third-party cookies or try Chrome/Edge. Some browsers block the CSRF session
earlier, so the login request may return 403 before that diagnostic can run.
An end-to-end real login/order test and real visitor IP verification through the
live tunnel remain manual; do not create real users/orders as an automated check.

Proxy references: [Express trust proxy](https://expressjs.com/en/api/application/),
[Cloudflare visitor headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/).

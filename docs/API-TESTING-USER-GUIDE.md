# API Testing Tab — User Guide & Feature Reference

This guide documents **all built features** in the API Testing tab with **day-to-day usage** and **how-to examples**. Use it for onboarding and daily testing workflows.

---

## 1. Builder Tab — Building & Sending Requests

### 1.1 URL and method

- **What:** Enter full URL (e.g. `https://api.example.com/users`) or use `{{base_url}}/users` with an environment.
- **How:** Choose method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) from the dropdown; type or paste URL in the bar; click **Send**.
- **Example:**  
  - `GET` `https://jsonplaceholder.typicode.com/posts`  
  - Or set env `base_url` = `https://jsonplaceholder.typicode.com` and URL = `{{base_url}}/posts`.

### 1.2 Params (query)

- **What:** Query parameters sent as `?key=value&...`.
- **How:** Open **Params** tab → Add rows (key/value), enable/disable with checkbox; optional value can use `{{var}}`.
- **Example:** `userId` = `1` → request URL gains `?userId=1`.

### 1.3 Headers

- **What:** HTTP headers (e.g. `Content-Type`, `Authorization`, custom).
- **How:** Open **Headers** tab → Add key/value; use `{{var}}` for dynamic values.
- **Example:** `Content-Type` = `application/json`, `X-Request-ID` = `{{requestId}}` (set in Before request or env).

### 1.4 Body

- **What:** Request body for POST/PUT/PATCH (none, JSON, form, XML, raw).
- **How:** Open **Body** tab → Choose type → Enter JSON/XML or form fields; body supports `{{var}}`.
- **Example:** JSON body `{ "title": "Hello", "userId": "{{userId}}" }` with `userId` from Before request or saved from a previous response.

### 1.5 Auth

- **What:** No Auth, Bearer Token, Basic Auth, API Key (header/query), OAuth 2.0.
- **How:** Open **Auth** tab → Select type → Fill token/username+password or API key name+value; for OAuth 2.0 choose a saved config and use **Get token and use as Bearer**.
- **Example:** Bearer token `{{access_token}}` (variable from env or saved from login response).

### 1.6 Before request (set variables)

- **What:** Set variables **before** each send so URL/headers/body can use `{{name}}`. No scripts — declarative only.
- **How:** Open **Before request** tab → **Set variable** → Variable name + type (Static, `$timestamp`, `$randomUUID`, `$randomInt`, `$randomEmail`, `$randomFullName`). For Static, enter value.
- **Example:** Variable `requestId` = `$randomUUID`; in Headers set `X-Request-ID` = `{{requestId}}`. Each Send gets a new UUID.

### 1.7 Cookies

- **What:** Cookies are stored automatically from `Set-Cookie` in responses and sent on matching domains. No scripts.
- **How:** After a request that returns `Set-Cookie`, open **Cookies** tab to see cookies by domain; remove per cookie or **Clear domain** if needed. Next request to the same host will send a `Cookie` header automatically.
- **Example:** Login returns `Set-Cookie: session=abc123` → Cookies tab shows domain + `session`; subsequent request to that host includes `Cookie: session=abc123`.

### 1.8 Request history

- **What:** Last 100 sent requests (method + URL + timestamp) for quick replay.
- **How:** Click **History** (clock icon) → Search by method or URL → Click a row to load that URL and method into the builder.
- **Example:** Send `GET {{base_url}}/users/1`, then later open History, click that entry to reload and send again.

### 1.9 Code snippet

- **What:** Generate cURL, Python (requests), or Node (fetch) snippet from current request.
- **How:** Click **Code** (</> icon) → Choose language → Snippet is copied to clipboard; toast confirms.
- **Example:** After building a POST with JSON body, copy **Python (requests)** to use in a script or notebook.

### 1.10 Save request / Add to chain / Add to Tests

- **What:** Save current request + assertions for reuse; add to a request chain; or add as a test case to the Execute tab.
- **How:**  
  - **Save:** Click Save icon → Enter name → request and assertions stored in **Saved Requests**; expand **Saved Requests** and click to load.  
  - **Chain:** Click **Chain** → request and assertions are added to the Chains flow.  
  - **Add to Tests:** Click **Add to Tests** → Enter test name → case appears in Execute tab and Tests page.

#### Builder → Execute tab & Tests tab

- **Add to Tests** does two things: (1) adds the test to the **Execute** tab in memory so you can run it immediately, and (2) saves it to the app database via `POST /api/db/test-cases` with `category: "api"`, tags including `api-testing`, and `metadata.type: "automated"` so it is treated as an API test (automation status **full**).
- **Tests tab:** The Tests section (Test Repository) loads test cases from several sources: Electron storage, localStorage, and **the same database** (`GET /api/db/test-cases`). So tests you add from Builder are persisted and appear in the Tests tab once the list is refreshed.
- **To see new API tests in Tests:** Open the **Tests** tab and click **Refresh** (↻). That reloads all sources (including API tests from the database). API tests are identifiable by tag `api-testing`, category `api`, and automation status **full**; you can filter by these if your Tests UI supports it.
- **Running API tests from the Tests tab:** When you click **Run** on an API test, the Run dialog shows “API test” and two behaviors: **Quick Run** runs the test via the API Testing engine (no UI builder) and shows pass/fail in the dialog; **Open in API Testing** opens the API tab so you can edit and run there. UI (Playwright) tests still open the regular builder and run there. So API and UI tests stay in one list; the app chooses the right runner by test type.

- **Example:** Save “Get user 1” and “Create user” for quick reload; or add “Get user 1” to Tests for regression runs.

---

## 2. Response — Viewing and Using the Response

### 2.1 Body and Headers tabs

- **What:** Response body (formatted JSON/XML when possible) and response headers.
- **How:** After **Send**, use **Body** and **Headers** tabs under the response; **Copy** copies body.
- **Example:** Confirm status 200, body structure, and headers like `Content-Type` or `X-RateLimit-Limit`.

### 2.2 Console (last request / last response)

- **What:** Read-only view of the **last request** (method, URL, headers, body) and **last response** (status, time, headers, body). No scripting.
- **How:** After sending, open **Console** tab in the response area to inspect exactly what was sent and received.
- **Example:** Debug by checking Console to see resolved `{{var}}` values and full request/response.

### 2.3 Assert Builder (tree + assertions from response)

- **What:** Tree view of the response JSON; add assertions or save values as variables from any node (including nested). Zero-code.
- **How:**  
  1. Send a request.  
  2. Open **Assert Builder** tab.  
  3. Use the tree: expand nodes (e.g. root array `[0]`, `[1]`, … or object keys).  
  4. **Assert:** Click **Assert** on a node — for parent nodes (object/array) this adds an “exists” assertion; for leaf nodes it adds a value assertion (e.g. equals).  
  5. **Save as variable:** Click **Save** on a node → Enter variable name → Use `{{name}}` in the next request (URL, headers, or body).
- **Path:** Each node shows a path (e.g. `$[4].title` for the 5th element’s `title`). Assertions use this path so the backend can evaluate JSONPath correctly.
- **Example:** Response is `[{ "id": 1, "title": "Hello" }, ...]`. Expand `[4]`, click **Assert** on `title` with value “nesciunt quas odio” → assertion “JSONPath `$[4].title` equals ‘nesciunt quas odio’”. Or **Save** `[0].id` as `firstId` and use `{{firstId}}` in the next request.

### 2.4 Assertions panel (list and results)

- **What:** List of assertions (status code, response time, contains, JSONPath, header, etc.) and their pass/fail after **Send**.
- **How:** Add assertions via **Assert Builder** or the **Assertions** tab (manual type/path/expected). After Send, each assertion shows **Pass** or **Fail** with message (e.g. expected vs actual).
- **Example:** Assertion “JSONPath `$[4].title` equals ‘nesciunt quas odio’” — if the API returns that value at `$[4].title`, it passes; otherwise you see “expected …, got …” (or “got undefined” if the path is missing).

---

## 3. Variables and Resolution Order

- **Order:** Global → Environment → Collection → Local (saved from response + before-request variables). Later scope overrides earlier.
- **Where to set:**  
  - **Environments** tab → **Variable scoping** → Global variables and Collection variables (key/value).  
  - **Builder** → Before request (local to request) and **Save as variable** from response (local to session).
- **Use:** In URL, headers, or body use `{{variableName}}`. Resolved at send time.
- **Example:** Global `api_host` = `https://api.example.com`, env `base_url` = `https://staging.example.com` → `{{base_url}}` wins in that environment.

---

## 4. Environments Tab

- **What:** Create and switch environments (e.g. Dev, Staging, Prod) with `base_url` and variables.
- **How:** Open **Environments** tab → Create/select environment → Set **base_url** and variables → In Builder, select the active environment from the dropdown.
- **Example:** Dev `base_url` = `http://localhost:3000`, Prod `base_url` = `https://api.myapp.com`; switch env to change which URL is used for `{{base_url}}`.

---

## 5. Mock Tab

- **What:** Create real HTTP mock servers, add endpoints (method/path/status/body), start/stop, view request logs, and verify that expected requests were made.
- **How:**  
  1. **Create:** Enter name and port → **Create Real Mock Server (HTTP)**.  
  2. **Add endpoint:** Select server → Method, path, status, response body (JSON), optional Dynamic (template variables) → **Add Endpoint**.  
  3. **Controls:** Select server → **Start** / **Stop** / **View Logs** (shows request log panel) / **Info** (server details) / **Refresh**.  
  4. **Verify:** Set method, path, optional expected count and body contains → **Verify** → see result (e.g. “received N requests”).
- **Example:** Create server on 8081, add `GET /api/users` → 200 with `[{ "id": 1 }]` → Start server → In Builder send `GET http://localhost:8081/api/users` → View Logs to see the request; Verify to assert it was called.

---

## 6. Execute Tab (Test Suite)

- **What:** Run a test suite (collection of test cases) in manual or automated mode; optional data-driven run (CSV/JSON); folders; load config.
- **How:**  
  - Add test cases (from Builder **Add to Tests**, or Import, or manual).  
  - Select environment and cases → **Run** (manual/automated).  
  - **Run with data:** Upload or paste CSV/JSON → **Create source & preview** → **Run with data** for data-driven execution.  
  - **Folders:** Use **Add folder** and assign test cases to folders for organization.  
  - **Load:** Set virtual users, duration, ramp-up, think time for load runs.
- **Example:** Create folder “Smoke”, add “Get health”, “Get users”; run with Dev environment; then run with data (CSV with `userId`) to repeat the same test for many users.

---

## 7. Import & Export

- **Import:** OpenAPI/Swagger (JSON/YAML), Postman Collection (v2.1), HAR, WSDL/SOAP, GraphQL schema; URL or file; one-click sample collections.
- **Export:** Postman collection, HAR.
- **How:** Use **Import** in the API tab to load a spec or collection; use **Export** to download.

---

## 8. Assert Builder — Fixing “expected X, got undefined”

If an assertion from Assert Builder fails with **“got undefined”**:

1. **Check the path:** The path (e.g. `$[4].title`) must match the **actual** response structure. If the root is an array, `$[4]` is the 5th element; if that element has no `title` key, you get undefined.
2. **Check the response:** Use **Body** or **Assert Builder** tree to confirm the key exists at that path (e.g. expand `[4]` and see if `title` is present).
3. **Re-add the assertion:** If the API response structure changed (e.g. different index or key name), remove the old assertion and add a new one from the current response so the path and expected value are correct.
4. **Backend vs UI:** Assertions are run on the server; the UI shows backend results when available. If you see “got undefined”, the server evaluated the path and found no value — so fix path or expected value as above.

---

## 9. Validating Many Fields and Regression (Compare to Previous)

### 9.1 Validating many fields (avoid one-by-one assertions)

When a response has many fields (e.g. 100), **do not** add 100 separate JSONPath assertions. Prefer:

- **JSON Schema assertion:** Add one assertion of type **JSON Schema**. Put a JSON Schema in the schema field (e.g. `{"type":"object","properties":{"id":{"type":"number"},"name":{"type":"string"},...}}`). The engine validates the **entire** response (or a subtree) in one go — structure, types, required fields. This is the right way to “loop” over all fields declaratively.
- **Script assertion (advanced):** If you need custom logic (e.g. “every item in the array must have a non-empty `title`”), use a **Script** assertion and write a small loop in code. Use Schema when possible; use Script only when you need behavior Schema can’t express.

So: **one Schema assertion** (or one per logical section) instead of one assertion per field.

### 9.2 Comparing to a previous response (regression)

Real testing is both **functional** (does it work?) and **regression** (did we break something that worked before?). To compare the **current** response to a **previous** (baseline) response:

1. **Matches baseline assertion:** Add an assertion of type **Matches Baseline**. You provide the “expected” response (baseline) as JSON.
2. **Capture baseline:** Run the request once when the API is known good → in the Assertions panel, for the “Matches baseline” assertion click **Use current as baseline**. That stores the last response body as the baseline.
3. **Later runs:** On subsequent runs, the engine compares the current response to that baseline. If they differ, the assertion fails (regression). If they match, it passes.

Use this to catch unintended changes in response shape or values (e.g. after a backend deploy). For intentional changes, update the baseline by running again and clicking **Use current as baseline**, or paste the new expected JSON.

---

## 10. Quick Reference — Where to Do What

| Goal                         | Where / How                                      |
|------------------------------|--------------------------------------------------|
| Send a one-off request       | Builder → URL + Send                             |
| Use env URL / vars           | Environments tab; Builder → select env           |
| Set a random or static var   | Builder → Before request                         |
| Use value from last response | Assert Builder → Save as variable → `{{name}}`   |
| Assert on response node      | Assert Builder → Assert on node                   |
| See last request/response    | Response → Console tab                           |
| Manage cookies               | Builder → Cookies tab                            |
| Reuse a past request         | History → click row                              |
| Copy as cURL/Python/Node     | Builder → Code dropdown                          |
| Run many test cases          | Execute tab → select cases → Run                 |
| Run with CSV/JSON rows       | Execute → Run with data (upload/preview/run)      |
| Mock an API                  | Mock tab → Create server → Add endpoint → Start   |
| Verify mock was called       | Mock tab → Verify (method/path/count/body)        |
| Validate many fields at once | Assertions → type **JSON Schema** (one assertion)  |
| Regression: compare to last | Assertions → type **Matches Baseline** + Use current as baseline |

---

*This guide reflects the current API Testing tab implementation (zero-code Builder, Assert Builder, variables, mock, execute, import/export). For a detailed comparison with Postman/ReadyAPI and the build plan, see `API-TESTING-POSTMAN-READYAPI-DEEP-DIVE.md`.*

# Full Enterprise Performance Test on AWS — 1 Hour, Scenario Mix, Full Observability

This guide walks you through **connecting to AWS**, **purchasing and configuring EC2** (and related resources), and running a **full 1-hour enterprise performance test** with **scenario mix** and **full observability** (Lighthouse, SRM, correlation). Everything an enterprise test would include.

**References:** [PERFORMANCE_PLATFORM_SINGLE_DOC.md](./PERFORMANCE_PLATFORM_SINGLE_DOC.md), [PERFORMANCE-ENTERPRISE-RUN-WALKTHROUGH.md](./PERFORMANCE-ENTERPRISE-RUN-WALKTHROUGH.md), [FLOWSTRAL-COM-LOAD-TEST-PLAN.md](./FLOWSTRAL-COM-LOAD-TEST-PLAN.md).

---

## Part 1: Connect to AWS (Detailed Steps)

You already have an AWS account. The steps below get you from **sign-in** to a **working AWS CLI** so you can create and manage EC2 from the command line (and from the console). Follow each subsection in order.

---

### 1.1 Sign in to the AWS Management Console

Since your account exists, start by signing in.

1. Open a browser and go to: **https://console.aws.amazon.com**
2. Sign in with your **root** account email and password (or with an IAM user if your org gave you one).
3. If you see a “Welcome” or “Get started” screen, you can dismiss it. You should see the **AWS Management Console** home (search bar at top, list of services).
4. **Bookmark** `https://console.aws.amazon.com` for quick access.

---

### 1.2 Create an IAM user for the CLI (recommended)

Using a dedicated IAM user (instead of the root account) is safer and lets you rotate keys without changing your root login.

**Step 1 — Open IAM**

1. In the top **search bar**, type **IAM** and press Enter.
2. Click **IAM** (Identity and Access Management).
3. In the left sidebar, click **Users**.

**Step 2 — Create the user**

1. Click the orange **Create user** button (top right).
2. **User name:** type `qaai-perf-admin` (or any name you prefer).
3. Leave “Provide user access to the AWS Management Console” **unchecked** — we only need CLI access. Click **Next**.

**Step 3 — Attach permissions**

1. Select **Attach policies directly**.
2. In the search box type **AdministratorAccess**.
3. Check the box next to **AdministratorAccess** (full access for EC2, VPC, IAM, etc.). If your org restricts this, use a custom policy with at least: `AmazonEC2FullAccess`, `AmazonVPCFullAccess`, and `IAMReadOnlyAccess`.
4. Click **Next**.

**Step 4 — Review and create**

1. Review the user name and policy; click **Create user**.
2. You should see a success message and the new user in the list. Click on the **user name** (`qaai-perf-admin`) to open its page.

**Step 5 — Create access keys (for CLI)**

1. Open the **Security credentials** tab.
2. Scroll to **Access keys**.
3. Click **Create access key**.
4. Select **Command Line Interface (CLI)**; check the confirmation box; click **Next**.
5. (Optional) Add a description, e.g. “QAAI performance testing”; click **Next**.
6. Click **Create access key**.
7. **Important:** You will see:
   - **Access key ID** (starts with `AKIA...`)
   - **Secret access key** (long string; shown only once)
8. Click **Download .csv file** and store it somewhere safe, or copy both values into a secure note. You will need them for `aws configure`.
9. Click **Done**.

---

### 1.3 Install AWS CLI on your machine

**On Windows (recommended: install AWS CLI v2)**

1. **Download the installer:**
   - Go to: **https://aws.amazon.com/cli/**
   - Under “AWS CLI v2” click **Download Windows x86_64** (or ARM64 if you use an ARM PC).  
   - Or direct MSI link: **https://awscli.amazonaws.com/AWSCLIV2.msi**
2. **Run the MSI:** Double-click the downloaded file. If Windows asks “Do you want to allow this app to make changes?”, click **Yes**.
3. **Installation wizard:** Click **Next** → accept the license → **Next** → **Install** → **Finish**.
4. **Confirm PATH:** The installer adds AWS CLI to your system PATH. Close any open PowerShell or Command Prompt windows and open a **new** one so the new PATH is picked up.

**Verify installation (in a new PowerShell window):**

```powershell
aws --version
```

You should see something like: `aws-cli/2.x.x Python/3.x.x Windows/10...`

**On macOS:**

```bash
# Option A — Homebrew (if you have it)
brew install awscli

# Option B — Official installer
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
aws --version
```

**On Linux (x86_64):**

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -o awscliv2.zip
sudo ./aws/install
aws --version
```

---

### 1.4 Configure the AWS CLI

1. Open **PowerShell** (or Terminal on Mac/Linux).
2. Run:

```powershell
aws configure
```

3. You will be prompted one by one. Use the **Access key ID** and **Secret access key** from step 1.2 (Step 5):

| Prompt | What to enter | Example |
|--------|----------------|--------|
| **AWS Access Key ID** | Paste your Access key ID | `AKIAIOSFODNN7EXAMPLE` |
| **AWS Secret Access Key** | Paste your Secret access key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| **Default region name** | Region for EC2 (use one close to you) | `us-east-1` |
| **Default output format** | How CLI returns data | `json` |

4. Press Enter after each value. When you finish, credentials are stored under your user folder (e.g. `C:\Users\<You>\.aws\credentials` and `config`).

**Regions you might use:** `us-east-1` (N. Virginia), `us-west-2` (Oregon), `eu-west-1` (Ireland). Use the same region for all resources in this guide.

---

### 1.5 Verify the connection

Run these two commands. They must succeed with no “Unable to locate credentials” or “Access Denied” errors.

**Who am I?**

```powershell
aws sts get-caller-identity
```

Expected (with your real IDs):

```json
{
    "UserId": "AIDAXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/qaai-perf-admin"
}
```

**List regions (optional):**

```powershell
aws ec2 describe-regions --output table
```

You should see a table of regions. Note the **region name** you used in `aws configure` (e.g. `us-east-1`); you will use it when creating EC2 in Part 2.

---

## Part 2: Purchase and Set Up EC2 (Detailed Steps)

You will create:

- **Option A** — Only **Go runner(s)** on EC2 (if you test an existing site like flowstral.com).
- **Option B** — **App server** (your app under test) + **Go runner(s)** on EC2.

Below is **Option B**. For Option A, skip the “App server” instance and use your existing **TARGET_URL**.

---

### 2.1 Choose region and find your VPC

**Select region (console)**

1. In the AWS Console, top-right corner: click the **region** dropdown (e.g. “N. Virginia” or “Ohio”).
2. Choose the **same region** you set in `aws configure` (e.g. **US East (N. Virginia) / us-east-1**). All EC2 resources in this guide should be in this region.

**Find your default VPC (so we can use it for instances)**

1. In the top search bar, type **VPC** and open **VPC**.
2. In the left sidebar, click **Your VPCs**.
3. You should see at least one VPC with **Name** like “Default” or blank and **Default** = “Yes”. Note its **VPC ID** (e.g. `vpc-0abc123def456`).
4. Click **Subnets** in the left sidebar. Note one or more **Subnet ID**s that belong to this default VPC (e.g. `subnet-0aaa1111`, `subnet-0bbb2222`). You will use one of these when launching instances; the **Launch instance** wizard can also pick a default subnet for you.

If you have **no default VPC** (e.g. you deleted it): VPC → Create VPC → “VPC and more” → Create VPC. Then use that VPC and its public subnets. For most accounts, the default VPC is enough.

---

### 2.2 Create a key pair (for SSH to EC2)

You need one key pair to log in to all EC2 instances (app server and runners).

1. In the top search bar, type **EC2** and open **EC2**.
2. In the **left sidebar**, under **Network & Security**, click **Key Pairs**.
3. Click **Create key pair** (orange button, top right).
4. **Name:** `qaai-perf-key` (must be unique in the region).
5. **Key pair type:** **RSA**.
6. **Private key format:**
   - **.pem** — use this if you will use **OpenSSH** (PowerShell, WSL, or Mac/Linux).
   - **.ppk** — use only if you will use **PuTTY** on Windows.
7. Click **Create key pair**. A file downloads (e.g. `qaai-perf-key.pem`).

**Store the key safely**

- **Windows:** Move the file to a folder that won’t be deleted, e.g. `C:\Users\<YourName>\.ssh\qaai-perf-key.pem`. If `.ssh` doesn’t exist, create it.
- **Mac/Linux:** Move to `~/.ssh/qaai-perf-key.pem`.

**Set permissions (Windows — optional but recommended)**

In PowerShell (run as yourself, not Administrator):

```powershell
icacls "$env:USERPROFILE\.ssh\qaai-perf-key.pem" /inheritance:r /grant:r "$env:USERNAME`:R"
```

**Important:** Do not share the `.pem` file or commit it to git. Anyone with this file can SSH into instances that use this key.

---

### 2.3 Create security groups (firewall rules)

Create **three** security groups in the **same region and VPC** you will use for instances.

**Open Security Groups**

1. In **EC2** left sidebar, under **Network & Security**, click **Security Groups**.
2. Confirm the **VPC** dropdown shows your default (or chosen) VPC. Click **Create security group**.

---

**Security group 1 — App server (`qaai-app-sg`)**

1. **Name:** `qaai-app-sg`  
   **Description:** Allow SSH, HTTP, HTTPS for app server.
2. **VPC:** Select your default VPC (e.g. `vpc-0abc123...`).
3. **Inbound rules — Add rule** for each row below:

| Type        | Port | Source        | Description   |
|------------|------|---------------|---------------|
| SSH        | 22   | My IP         | Your computer |
| HTTP       | 80   | 0.0.0.0/0     | Anyone        |
| HTTPS      | 443  | 0.0.0.0/0     | Anyone        |

- For **My IP**: click “My IP” in the dropdown (it fills your current public IP). For stricter security you can use a specific CIDR (e.g. office IP) instead of 0.0.0.0/0 for SSH.
4. **Outbound rules:** Leave default (all traffic to 0.0.0.0/0).
5. Click **Create security group**.

---

**Security group 2 — Go runners (`qaai-runner-sg`)**

1. **Create security group** again.  
   **Name:** `qaai-runner-sg`  
   **Description:** SSH and runner port for Go load runners.  
   **VPC:** Same as above.
2. **Inbound rules:**

| Type   | Port  | Source   | Description        |
|--------|-------|----------|--------------------|
| SSH    | 22    | My IP    | Your computer      |
| Custom TCP | 50051 | My IP **or** 0.0.0.0/0 | QAAI backend (or open for testing) |

- Use **0.0.0.0/0** for 50051 only if your QAAI backend is not in the same VPC; for production prefer “My IP” or the backend’s IP/CIDR.
3. **Outbound:** Leave default. Click **Create security group**.

---

**Security group 3 — QAAI backend (`qaai-backend-sg`)** — only if you run the backend on EC2

1. **Create security group**.  
   **Name:** `qaai-backend-sg`  
   **Description:** SSH and API for QAAI backend.  
   **VPC:** Same as above.
2. **Inbound rules:**

| Type        | Port | Source | Description   |
|------------|------|--------|---------------|
| SSH        | 22   | My IP  | Your computer |
| Custom TCP | 8000 | My IP or 0.0.0.0/0 | Frontend / API calls |

3. **Outbound:** Default. Click **Create security group**.

---

### 2.4 Launch EC2 instances

**Instance 1 — App server (website/API under test)**

1. In **EC2** left sidebar, click **Instances**.
2. Click **Launch instance** (orange button).
3. **Name:** `qaai-app-server`.
4. **Application and OS Images (AMI):**  
   - **Quick Start** tab → **Amazon Linux** → pick **Amazon Linux 2023** (or **Ubuntu Server 22.04 LTS** if you prefer; login user will be `ubuntu` instead of `ec2-user`).
5. **Instance type:** Click the dropdown → select **t3.medium** (2 vCPU, 4 GB RAM). For heavier load, use t3.large or t3.xlarge.
6. **Key pair:** Click **Select existing** → choose **qaai-perf-key**. (If you don’t see it, ensure you’re in the same region as the key pair.)
7. **Network settings — Edit:**
   - **VPC:** Default (or your chosen VPC).
   - **Subnet:** Pick any **public** subnet (e.g. “Default subnet in us-east-1a”).
   - **Auto-assign public IP:** **Enable**.
   - **Firewall (security groups):** **Select existing** → choose **qaai-app-sg**.
8. **Storage:** Change size to **20** GiB (or 30); type **gp3** is fine. Click **Add more** only if you need extra volumes.
9. **Advanced details:** Optional. Leave defaults unless you need a specific IAM role or user data.
10. Click **Launch instance**. You’ll see a success message and the instance ID (e.g. `i-0abc123def456`).

**Get the app server’s public IP**

1. Click **View all instances** (or go to **Instances** in the sidebar).
2. Select the instance **qaai-app-server** (checkbox).
3. In the **Details** tab below, find **Public IPv4 address**. That is your **TARGET_URL** base, e.g. `http://54.123.45.67`. Write it down.

**Your setup (fill as you launch each instance):**

| Variable | Value | Notes |
|----------|--------|--------|
| **TARGET_URL** | **http://34.224.23.116** | App server (first EC2). Use this in Recorder, Lighthouse, SRM, and run-mix. |
| **RUNNER1_IP** | **3.81.20.46** | Go runner 1 — register with backend. |
| **RUNNER2_IP** | _(fill after launching runner 2)_ | Go runner 2 — register with backend. |
| **BACKEND_URL** | _(optional; if backend on EC2)_ | e.g. `http://<backend-ip>:8000`. |

---

**Instance 2 — Go runner 1 (`qaai-runner-1`)**

1. Click **Launch instance** again.
2. **Name:** `qaai-runner-1`.
3. **AMI:** Same as above (Amazon Linux 2023 or Ubuntu 22.04).
4. **Instance type:** **t3.large** (2 vCPU, 8 GB) or **t3.xlarge** (4 vCPU, 16 GB) for more VUs.
5. **Key pair:** **qaai-perf-key**.
6. **Network settings — Edit:** Same VPC; any public subnet; **Auto-assign public IP:** Enable; **Security group:** **qaai-runner-sg**.
7. **Storage:** 20 GiB gp3.
8. Click **Launch instance**. When it appears in the list, note its **Public IPv4 address** (e.g. `RUNNER1_IP`).

---

**Instance 3 — Go runner 2 (`qaai-runner-2`)**

1. **Launch instance** again.
2. **Name:** `qaai-runner-2`.
3. **AMI, instance type, key pair, network, storage:** Same as runner 1 (e.g. t3.large, qaai-runner-sg, 20 GiB).
4. **Launch instance**. Note its **Public IPv4 address** (`RUNNER2_IP`).

---

**Optional — Instance 4: QAAI backend on EC2**

- If you want the QAAI backend on AWS instead of your laptop: **Launch instance** → Name `qaai-backend` → same AMI → **t3.medium** → **qaai-perf-key** → Security group **qaai-backend-sg** → 20 GiB → Launch. Note its **Public IPv4** for **BACKEND_URL**.

---

**Wait for “Running” and “2/2 checks passed”**

- In **Instances**, wait until **Instance state** is **Running** and **Status check** is **2/2 checks passed** (usually 1–2 minutes). Then you can SSH.

---

### 2.5 Connect to EC2 via SSH (Windows)

**Using PowerShell (OpenSSH)**

1. Open **PowerShell**.
2. If your key is in `C:\Users\<You>\.ssh\qaai-perf-key.pem` and the app server IP is `54.123.45.67`:

```powershell
ssh -i "$env:USERPROFILE\.ssh\qaai-perf-key.pem" ec2-user@54.123.45.67
```

- For **Ubuntu** AMI, use `ubuntu` instead of `ec2-user`:

```powershell
ssh -i "$env:USERPROFILE\.ssh\qaai-perf-key.pem" ubuntu@54.123.45.67
```

3. First time: type **yes** when asked “Are you sure you want to continue connecting?”.
4. You should get a prompt like `[ec2-user@ip-172-31-xx-xx ~]$`. You are now on the app server.

**If you get “Permission denied (publickey)”**

- Check the key path and that you’re using the correct username (`ec2-user` for Amazon Linux, `ubuntu` for Ubuntu).
- Ensure the instance has the **qaai-perf-key** key pair and the security group allows **SSH (22)** from **My IP**.

**If PowerShell says “running scripts is disabled”**

- Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` (then try SSH again).

**Connect to runners**

- Same command, different IP and same user:

```powershell
ssh -i "$env:USERPROFILE\.ssh\qaai-perf-key.pem" ec2-user@3.81.20.46
ssh -i "$env:USERPROFILE\.ssh\qaai-perf-key.pem" ec2-user@<RUNNER2_IP>
```

**If browser “Connect” fails (Error establishing SSH connection)**

1. **Security group** — The instance (e.g. runner at 3.81.20.46) must use a security group that allows **SSH (22)** from your **current** IP.  
   - In **EC2 → Security Groups**, open **qaai-runner-sg** (or whichever SG the runner uses).  
   - **Inbound rules:** Ensure there is a rule **Type SSH, Port 22, Source = My IP** (or 0.0.0.0/0 to test).  
   - If your IP changed (different Wi‑Fi, VPN, or you set “My IP” from another machine), click **Edit inbound rules** → edit the SSH rule → set **Source** to **My IP** again (to refresh), or temporarily **0.0.0.0/0** to confirm it’s an IP block — then lock back to My IP.
2. **Instance ready** — In **EC2 → Instances**, check the instance: **Instance state** = Running, **Status check** = 2/2 checks passed. Wait 1–2 minutes after launch if needed.
3. **Try PowerShell instead of browser** — From your PC:  
   `ssh -i "$env:USERPROFILE\.ssh\qaai-perf-key.pem" ec2-user@3.81.20.46`  
   Same rule: port 22 must be allowed from your IP in the instance’s security group.

**Optional — PuTTY (Windows)**

- Convert `.pem` to `.ppk` with PuTTYgen, then in PuTTY set Connection → SSH → Auth → Private key file to the `.ppk`. Host: `ec2-user@<IP>`.

---

### 2.6 Deploy your app on the app server (if Option B)

**Example — Node.js app:**

```bash
# On app server (ec2-user)
sudo dnf install -y nodejs git   # Amazon Linux
# or: sudo apt update && sudo apt install -y nodejs npm git   # Ubuntu
git clone <your-repo> app && cd app
npm install && npm run build
# Serve: e.g. nginx or node server.js on port 80
sudo dnf install -y nginx
# Configure nginx to proxy or serve static from build/
sudo systemctl enable nginx && sudo systemctl start nginx
```

**Or static site (S3 + CloudFront):** Build locally, upload to S3, create CloudFront distribution; use that URL as **TARGET_URL** (see PERFORMANCE-ENTERPRISE-RUN-WALKTHROUGH.md Part A).

**Result:** You have **TARGET_URL** (e.g. `http://<APP_SERVER_IP>` or `https://your-domain.com`).

---

## Part 3: Install and Run QAAI (Backend + Frontend)

You can run these **on your laptop** or on the optional **QAAI backend EC2**.

### 3.1 Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- **Node.js 18+** must be installed on the same machine (for Lighthouse). Ensure `npx` is on PATH.
- If backend is on EC2: ensure security group allows **8000** from your IP (or from runner IPs if they call the backend). Note **BACKEND_URL** (e.g. `http://<BACKEND_EC2_IP>:8000`).

### 3.2 Frontend

```bash
# From repo root
npm install && npm run dev
```

- Set **VITE_API_URL** (or your env) to **BACKEND_URL** so the Performance tab talks to the correct API.
- Open the app (e.g. `http://localhost:5173`).

---

## Part 4: Build and Run Go Runners on EC2

On **each** runner EC2 (`qaai-runner-1`, `qaai-runner-2`):

### 4.1 Install Go

```bash
# Amazon Linux / RHEL
sudo dnf install -y go
# Or download: https://go.dev/dl/  (e.g. go1.21.linux-amd64.tar.gz)
# sudo tar -C /usr/local -xzf go1.21.linux-amd64.tar.gz
# export PATH=$PATH:/usr/local/go/bin
go version
```

### 4.2 Build and run the runner

```bash
cd runner   # Clone the repo or copy the runner folder onto the EC2
go build -o runner ./cmd/runner
./runner --port 50051 --max-vus 1000
```

- Keep this running (use `tmux` or `screen` if you disconnect: `tmux new -s runner`, then run `./runner ...`).
- **Runner 1:** `http://<RUNNER1_IP>:50051`  
- **Runner 2:** `http://<RUNNER2_IP>:50051`

### 4.3 Register runners with the backend

From your machine (or Postman), call the backend:

```http
POST BACKEND_URL/api/performance/runner/register
Content-Type: application/json

{ "hostname": "<RUNNER1_IP>", "port": 50051, "max_vus": 1000 }
```

Repeat for runner 2:

```http
POST BACKEND_URL/api/performance/runner/register
Content-Type: application/json

{ "hostname": "<RUNNER2_IP>", "port": 50051, "max_vus": 1000 }
```

**Verify:**

```http
GET BACKEND_URL/api/performance/runner/status
```

You should see both runners and total capacity (e.g. 2000 VUs).

---

## Part 5: Set Up SRM (Server Resource Monitoring)

SRM collects CPU, memory (and optionally disk/network) from the **app server** so you can correlate load with server health.

### 5.1 Ensure SSH access to the app server

- You must be able to SSH into the app server (the EC2 that serves **TARGET_URL**). If the app is only on S3+CloudFront, there is no host to monitor; skip SRM or point SRM at another backend you control.

### 5.2 Add server and start monitoring (UI)

1. In the app: **Performance** → **Setup** (or SRM section).
2. **Add server:**
   - **Server type:** `linux_ssh`.
   - **Host:** App server public IP or private IP (if backend and app are in same VPC).
   - **Port:** 22.
   - **Username:** `ec2-user` (Amazon Linux) or `ubuntu` (Ubuntu).
   - **Authentication:** Upload or paste the private key (contents of `qaai-perf-key.pem`) or use **Private key path** if the backend has access to the file.
3. **Start monitoring** with interval e.g. **5** seconds.

### 5.3 Add server via API

```http
POST BACKEND_URL/api/srm/servers
Content-Type: application/json

{
  "alias": "app-server",
  "server_type": "linux_ssh",
  "host": "<APP_SERVER_IP>",
  "port": 22,
  "username": "ec2-user",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
}
```

Then:

```http
POST BACKEND_URL/api/srm/start
Content-Type: application/json

{ "interval_seconds": 5 }
```

Confirm in the Performance tab that CPU/memory metrics are updating.

---

## Part 6: Record Scenarios and Create Scenario Mix (3 Journeys)

For a **1-hour enterprise test with scenario mix**, you need **three recorded flows** (e.g. homepage-only, homepage+scroll, homepage+clicks) turned into **three scenarios**, then run with weights.

### 6.1 Record three journeys

1. Open **Recorder** (Playwright Recorder / Flowstral). Enable **Load Testing** and **Protocol Capture**.
2. **Journey 1 — Homepage only:** Start recording → go to **TARGET_URL** → wait for full load → stop. Click **Quick Load Test / Open Perf tab** so a draft is created. Note or copy the **draft_id** from the URL (`?draft_id=...`).
3. **Journey 2 — Homepage + scroll:** New recording → **TARGET_URL** → scroll down the page → stop. **Quick Load Test** again; note the second **draft_id**.
4. **Journey 3 — Homepage + clicks:** New recording → **TARGET_URL** → click 1–2 links (e.g. “Learn more”, “Watch Demo”) → stop. **Quick Load Test**; note the third **draft_id**.

### 6.2 Compile each draft into a scenario (get scenario_id)

For **each** draft, call compile so the backend returns a **scenario_id**:

**Draft 1 (homepage-only):**

```http
GET BACKEND_URL/api/performance/drafts/<DRAFT_ID_1>
```

Use the `draft.requests` from the response in:

```http
POST BACKEND_URL/api/performance/compile/load-requests
Content-Type: application/json

{
  "requests": [ ... paste draft.requests ... ],
  "name": "Journey 1 - Homepage only",
  "config": {
    "virtual_users": 100,
    "duration_seconds": 3600,
    "ramp_up_seconds": 600,
    "target_url": "TARGET_URL"
  }
}
```

Response includes **scenario_id** (e.g. `scenario_abc123`). Save it as **SCENARIO_ID_1**.

**Draft 2 and 3:** Repeat with `drafts/<DRAFT_ID_2>` and `drafts/<DRAFT_ID_3>`, names "Journey 2 - Homepage + scroll" and "Journey 3 - Homepage + clicks". Save **SCENARIO_ID_2** and **SCENARIO_ID_3**.

---

## Part 7: Run the Full 1-Hour Enterprise Test (Scenario Mix + Observability)

Execute in this order so you get **Lighthouse baseline → SRM during load → scenario-mix run → SRM correlation → Lighthouse after**.

### Step 1: Lighthouse baseline (before load)

1. **Performance** → **Lighthouse** tab.
2. **URL:** `TARGET_URL`. **Device:** Desktop (or Mobile).
3. Click **Run Lighthouse** (or **Run hardened** for median of 3).
4. Save or screenshot **Performance score**, **LCP**, **FCP**, **CLS**, **TBT**, **TTI**.

**API:**

```http
POST BACKEND_URL/api/performance/lighthouse/run-hardened
Content-Type: application/json

{ "url": "TARGET_URL", "form_factor": "desktop", "runs": 3, "cache_strategy": "cold" }
```

### Step 2: Start SRM

- In the app: **Performance** → **Setup** → **Start monitoring** (if not already running).
- Or: `POST BACKEND_URL/api/srm/start` with `{ "interval_seconds": 5 }`.

### Step 3: Start the 1-hour scenario-mix load test

**Parameters:**

- **Virtual users:** 2000 (must be ≤ sum of runners’ `max_vus`).
- **Duration:** 3600 seconds (1 hour).
- **Ramp-up:** 600 seconds (10 minutes).
- **Scenario mix:** e.g. 50% Journey 1, 30% Journey 2, 20% Journey 3.

**API:**

```http
POST BACKEND_URL/api/performance/tests/run-mix
Content-Type: application/json

{
  "scenario_mix": [
    { "scenario_id": "SCENARIO_ID_1", "weight_pct": 50 },
    { "scenario_id": "SCENARIO_ID_2", "weight_pct": 30 },
    { "scenario_id": "SCENARIO_ID_3", "weight_pct": 20 }
  ],
  "virtual_users": 2000,
  "duration_seconds": 3600,
  "ramp_up_seconds": 600,
  "ramp_down_seconds": 300,
  "think_time_ms": 1500,
  "base_url": "TARGET_URL"
}
```

Response: **parent test_id** (e.g. `test_mix_xyz`). Use this for status and report.

**Optional — use distributed runners:** If your backend uses the Go runner client with `use_distributed: true`, the same run can split VUs across runner 1 and runner 2 automatically (see PERFORMANCE_PLATFORM_SINGLE_DOC.md).

### Step 4: Monitor the run (1 hour)

- **Status:**  
  `GET BACKEND_URL/api/performance/tests/<parent_test_id>/status`  
  Poll every 30–60 seconds until `status` is `completed` or `stopped`.
- **Live metrics (if supported):**  
  `GET BACKEND_URL/api/performance/tests/<parent_test_id>/metrics`
- **SRM:** Keep monitoring running for the full hour so correlation has full CPU/memory data.

### Step 5: Stop SRM and fetch correlation

1. After the test finishes: **Performance** → **Setup** → **Stop monitoring**.  
   Or: `POST BACKEND_URL/api/srm/stop`
2. **View correlation:** **Performance** → Correlation view, or  
   `GET BACKEND_URL/api/srm/correlation`  
   Use this to see **response time vs CPU/memory** over the 1-hour window.

### Step 6: Get aggregated report and verdict

```http
GET BACKEND_URL/api/performance/tests/<parent_test_id>/report
```

Response includes aggregated metrics (latency percentiles, RPS, errors) and **verdict** (pass/fail if thresholds were set).

### Step 7: Lighthouse again (after load)

- Run **Lighthouse** again on **TARGET_URL** (same as Step 1).
- Compare **Performance score** and **LCP/FCP/CLS** to the baseline to see impact of the 1-hour load.

---

## Part 8: One-Page Checklist (Enterprise 1-Hr Test)

- [ ] **AWS:** Account created; CLI installed and `aws configure`; `aws sts get-caller-identity` works.
- [ ] **EC2:** Key pair created; security groups (app, runner, optional backend) created; 2–3 instances launched (app server, runner 1, runner 2).
- [ ] **App:** Deployed on app server (or use existing TARGET_URL); TARGET_URL is reachable from browser and from runner EC2s.
- [ ] **QAAI:** Backend running (port 8000); Node.js available for Lighthouse; frontend running and pointed at backend.
- [ ] **Runners:** Go built and running on each runner EC2 (port 50051); both registered with backend; `GET /api/performance/runner/status` shows 2000 (or desired) capacity.
- [ ] **SRM:** App server added (SSH); monitoring started; CPU/memory visible in Performance tab.
- [ ] **Scenarios:** Three drafts recorded (Journey 1, 2, 3); each compiled via `/compile/load-requests`; three `scenario_id`s saved.
- [ ] **Lighthouse baseline:** Run and record scores.
- [ ] **SRM start:** Monitoring running before load.
- [ ] **Run-mix:** `POST /tests/run-mix` with 2000 VUs, 3600 s duration, 600 s ramp-up, scenario_mix 50/30/20; note parent test_id.
- [ ] **Monitor:** Poll status until completed; keep SRM running full hour.
- [ ] **SRM stop:** Stop monitoring; fetch correlation.
- [ ] **Report:** `GET /tests/<parent_test_id>/report`; check verdict and metrics.
- [ ] **Lighthouse after:** Run again; compare to baseline.

---

## Part 9: Cost and Sizing (Rough Guide)

| Resource | Example | Approx. cost (1 hr, us-east-1) |
|----------|--------|----------------------------------|
| App server | t3.medium | ~\$0.04/hr |
| Go runner × 2 | t3.large each | ~\$0.07/hr each → ~\$0.14/hr |
| Optional backend EC2 | t3.medium | ~\$0.04/hr |
| Data transfer | Out to internet | ~\$0.09/GB (first 10 GB often free) |
| **Total (runners + app)** | | **~\$0.20–0.25/hr** for the 1-hour test |

- For **2000 VUs** sustained, 2× t3.large runners is a reasonable start; scale up instance type or add more runners if you see high CPU on runners.
- Use **same region** (e.g. us-east-1) for app and runners to keep latency low and data transfer cheaper.

---

## Part 10: Troubleshooting

| Issue | What to check |
|-------|----------------|
| `aws` not found | Install AWS CLI and ensure it’s on PATH. |
| SSH “Permission denied” | Key file permissions (`chmod 400 .pem`); correct user (`ec2-user` vs `ubuntu`). |
| Runners not visible | Security group allows 50051 from backend; runner process running; register with correct IP and port. |
| Run-mix returns 400 | `scenario_mix` must be a list of `{ scenario_id, weight_pct }`; all scenario_ids from compile; weight_pct sum can be 100. |
| SRM no data | SSH works from backend to app server; correct key/host/user; monitoring started before load. |
| High latency from runners | Run app and runners in the same region; check security groups and VPC routing. |
| Lighthouse timeout | Increase timeout in API; ensure TARGET_URL is http(s) and reachable from backend. |

---

## References

- [PERFORMANCE_PLATFORM_SINGLE_DOC.md](./PERFORMANCE_PLATFORM_SINGLE_DOC.md) — architecture, Go runner vs k6, VUs, cost.
- [PERFORMANCE-ENTERPRISE-RUN-WALKTHROUGH.md](./PERFORMANCE-ENTERPRISE-RUN-WALKTHROUGH.md) — deploy site to AWS, browser run, API run, Go runner, SRM, Lighthouse.
- [FLOWSTRAL-COM-LOAD-TEST-PLAN.md](./FLOWSTRAL-COM-LOAD-TEST-PLAN.md) — what to record on flowstral.com, scenario mix, 2000+ VU.
- [PERFORMANCE-BETTER-THAN-K6-IMPLEMENTATION.md](./PERFORMANCE-BETTER-THAN-K6-IMPLEMENTATION.md) — run-mix, verdict, webhook, distributed, export k6, full-test button.

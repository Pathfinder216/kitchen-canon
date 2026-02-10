# Let Them Cook - Technical Architecture

## Architecture Overview

**Architecture Pattern**: Client-Server with Progressive Web App (PWA)
- **Frontend**: React-based PWA for mobile-first, offline-capable experience
- **Backend**: Node.js REST API server
- **Database**: SQLite with abstraction layer for future migration
- **Hosting**: Self-hosted on Windows 11 PC (with future migration path to dedicated hardware)

---

## Technology Stack

### Frontend

#### Core Framework
- **React 18+** - Component-based UI framework
  - Excellent mobile support
  - Large ecosystem
  - Good PWA tooling
- **Vite** - Build tool and dev server
  - Fast development experience
  - Optimized production builds
  - Better than Create React App for modern development

#### PWA & Offline Support
- **Service Workers** (via Workbox)
  - Cache-first strategy for app shell
  - Network-first for API calls with offline fallback
  - Background sync for recipe edits made offline
- **IndexedDB** (via Dexie.js)
  - Local database for offline recipe storage
  - Stores recipes, meal plans, and meal history
  - Syncs with server when online
- **Web App Manifest** - Install to home screen, splash screen

#### UI & Styling
- **Tailwind CSS** - Utility-first CSS framework
  - Mobile-first by default
  - Small bundle size with purging
  - Fast development
- **Headless UI** or **Radix UI** - Accessible component primitives
  - Dialog/modal components
  - Dropdown menus
  - Toggle switches

#### Key Browser APIs
- **Screen Wake Lock API** - Prevent screen sleep in cook mode
- **Web Share API** - Native sharing on mobile
- **File System Access API** - For importing recipe files (with fallback to file input)
- **Clipboard API** - Copy grocery lists

#### State Management
- **React Query (TanStack Query)** - Server state management
  - Caching and synchronization
  - Optimistic updates
  - Perfect for offline-first apps
- **Zustand** or **Context API** - Client state management
  - Current meal plan
  - UI state (cook mode, filters)
  - User preferences

#### Routing
- **React Router v6** - Client-side routing
  - Nested routes for recipe/meal hierarchy
  - Lazy loading for code splitting

### Backend

#### Runtime & Framework
- **Node.js 20+ LTS** - JavaScript runtime
  - Cross-platform (Windows, Linux, macOS)
  - Large ecosystem
  - Good async I/O for file operations
- **Express.js** - Web framework
  - Lightweight and flexible
  - Extensive middleware ecosystem
  - RESTful API design

#### API Design
- **RESTful API** with conventional HTTP methods
  - `GET /api/recipes` - List recipes
  - `POST /api/recipes` - Create recipe
  - `GET /api/recipes/:id` - Get recipe
  - `PATCH /api/recipes/:id` - Update recipe (creates new version)
  - `GET /api/recipes/:id/versions` - Get recipe versions
  - `GET /api/meal-plans` - List meal plans
  - `POST /api/meal-plans` - Create meal plan
  - `POST /api/recipes/import` - Import recipe from URL/file
  - `GET /api/export` - Export all recipes

#### Database & ORM
- **SQLite** - Embedded database
  - No separate database server needed
  - Perfect for single-user applications
  - Single file database (easy backups)
  - Supports concurrent reads
  - Cross-platform (works on Windows, Linux, macOS)
- **Prisma ORM** - Database toolkit
  - Type-safe database client
  - Migration system
  - Easy to swap databases (SQLite → PostgreSQL) in future
  - Schema-driven development

#### File Storage
- **Local Filesystem** - Initial implementation
  - Store images/videos in organized directory structure
  - Windows: `C:\Users\benno\Documents\GitHub\let-them-cook\data\media\recipes\{recipeId}\images\`
  - Cross-platform paths handled by Node.js `path` module
- **Storage Abstraction Layer** - Interface for future cloud migration
  ```typescript
  interface StorageProvider {
    upload(file: Buffer, path: string): Promise<string>
    download(path: string): Promise<Buffer>
    delete(path: string): Promise<void>
    getUrl(path: string): string
  }
  ```
  - Implement `LocalStorageProvider` initially
  - Easy to add `S3StorageProvider`, `GCSStorageProvider` later

#### Recipe Parsing & Import
- **cheerio** - HTML parsing for web scraping
  - Extract schema.org Recipe structured data
  - Fallback to custom parsing for common recipe sites
- **pdf-parse** - Extract text from PDF files
- **mammoth** - Parse .docx files to extract text
- **Tesseract.js** - OCR for recipe photos
  - Extract text from images of recipe cards
  - May need to run on server or client depending on performance
- **Custom recipe parser** - Parse extracted text into structured recipe
  - Use regex patterns for ingredients/steps
  - ML/LLM enhancement opportunity in future

#### Authentication (Future)
- **Passport.js** with JWT - When multi-user support is added
  - Local strategy for username/password
  - OAuth providers (Google, GitHub) for easier onboarding

#### Validation
- **Zod** - Schema validation
  - Runtime type checking for API inputs
  - Shared schemas between frontend and backend

#### Process Management
- **PM2** - Production process manager (optional)
  - Auto-restart on crash
  - Log management
  - Works on Windows, Linux, macOS
  - Can run as Windows service for auto-start on boot

### Database Schema Design

#### Core Tables (via Prisma Schema)

```prisma
model Recipe {
  id            String    @id @default(uuid())
  title         String
  servings      Int
  totalTime     Int?      // minutes
  activeTime    Int?      // minutes
  source        String?   // Original URL or source name
  archived      Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Versioning
  version       Int       @default(1)
  parentId      String?   // ID of previous version
  parent        Recipe?   @relation("RecipeVersions", fields: [parentId], references: [id])
  versions      Recipe[]  @relation("RecipeVersions")

  // Relations
  ingredients   Ingredient[]
  steps         Step[]
  media         Media[]
  categories    RecipeCategory[]
  labels        RecipeLabel[]
  authorNotes   String?
  personalNotes String?

  mealRecipes   MealRecipe[]
}

model Ingredient {
  id              String   @id @default(uuid())
  recipeId        String
  recipe          Recipe   @relation(fields: [recipeId], references: [id])

  name            String   // Standardized name
  originalName    String?  // Original name from source
  amount          Float?
  unit            String?
  isOptional      Boolean  @default(false)
  order           Int      // Display order

  // For percent-based references in steps
  internalId      String   // e.g., "oil_1" for referencing in steps
}

model Step {
  id              String   @id @default(uuid())
  recipeId        String
  recipe          Recipe   @relation(fields: [recipeId], references: [id])

  order           Int
  instruction     String   // Can include {oil_1:50%} for "50% of ingredient 'oil_1'"
  timeMinutes     Int?
  isActiveTime    Boolean  @default(true)

  media           Media[]
}

model Media {
  id              String   @id @default(uuid())
  type            String   // 'image' | 'video'
  path            String   // File path or URL
  order           Int?

  recipeId        String?
  recipe          Recipe?  @relation(fields: [recipeId], references: [id])

  stepId          String?
  step            Step?    @relation(fields: [stepId], references: [id])
}

model Category {
  id              String   @id @default(uuid())
  name            String   @unique // e.g., "dinner", "appetizer", "side"
  recipes         RecipeCategory[]
}

model RecipeCategory {
  recipeId        String
  categoryId      String
  recipe          Recipe   @relation(fields: [recipeId], references: [id])
  category        Category @relation(fields: [categoryId], references: [id])

  @@id([recipeId, categoryId])
}

model Label {
  id              String   @id @default(uuid())
  type            String   // 'dietary', 'allergen', 'equipment', 'makeAhead'
  name            String   // e.g., "gluten-free", "contains-nuts", "slow-cooker"
  autoDetectable  Boolean  @default(false)

  recipes         RecipeLabel[]
}

model RecipeLabel {
  recipeId        String
  labelId         String
  recipe          Recipe   @relation(fields: [recipeId], references: [id])
  label           Label    @relation(fields: [labelId], references: [id])

  isAutoGenerated Boolean  @default(false)

  @@id([recipeId, labelId])
}

model IngredientSubstitution {
  id              String   @id @default(uuid())
  fromIngredient  String   // Standardized ingredient name
  toIngredient    String   // Substitute ingredient name
  ratio           Float    // Conversion ratio (e.g., 1:3 for fresh:dried herbs)
  notes           String?  // e.g., "Best for baking"

  // User-contributed
  createdBy       String?  // Future: user ID
  isOfficial      Boolean  @default(false)
}

model LocalizationMapping {
  id              String   @id @default(uuid())
  locale          String   // e.g., "en-US", "en-GB"
  originalName    String   // e.g., "coriander"
  localizedName   String   // e.g., "cilantro"

  @@unique([locale, originalName])
}

model MealPlan {
  id              String   @id @default(uuid())
  name            String?  // Optional name for the meal
  createdAt       DateTime @default(now())
  cookedAt        DateTime? // When the meal was actually cooked

  recipes         MealRecipe[]
  groceryList     GroceryItem[]
}

model MealRecipe {
  id              String   @id @default(uuid())
  mealPlanId      String
  mealPlan        MealPlan @relation(fields: [mealPlanId], references: [id])

  recipeId        String
  recipe          Recipe   @relation(fields: [recipeId], references: [id])

  recipeVersion   Int      // Snapshot of version used
  servings        Int      // May be different from recipe default

  order           Int?     // Order in the meal
}

model GroceryItem {
  id              String   @id @default(uuid())
  mealPlanId      String
  mealPlan        MealPlan @relation(fields: [mealPlanId], references: [id])

  ingredient      String
  amount          Float?
  unit            String?
  purchased       Boolean  @default(false)
}

model UserPreferences {
  id              String   @id @default(uuid())
  locale          String   @default("en-US")
  theme           String   @default("light")

  // Future: dietary restrictions, allergens to flag, etc.
}
```

---

## Hosting & Deployment

### Windows 11 Setup

#### Prerequisites
- Windows 11 PC (any modern PC with 4GB+ RAM)
- Administrator access for installing software
- ~10GB free disk space (more if storing many recipes with media)

#### System Dependencies

**1. Install Node.js**
- Download from https://nodejs.org/ (LTS version, currently 20.x)
- Run installer with default options
- Verify installation:
  ```powershell
  node --version  # Should show v20.x.x
  npm --version   # Should show 10.x.x
  ```

**2. Install Git** (if not already installed)
- Download from https://git-scm.com/download/win
- Use default options during installation

**3. Install SQLite CLI** (optional, for database inspection)
- Download from https://www.sqlite.org/download.html
- Extract to a folder and add to PATH (optional)

**4. Install PM2** (optional, for production-like setup)
```powershell
npm install -g pm2
npm install -g pm2-windows-service
```

**5. Install Windows Terminal** (recommended)
- Available in Microsoft Store
- Better terminal experience than default Command Prompt

### Application Setup

#### Directory Structure
```
C:\Users\benno\Documents\GitHub\let-them-cook\
├── frontend\
│   ├── src\
│   ├── dist\              # Built React app (production)
│   ├── package.json
│   └── ...
├── backend\
│   ├── src\
│   ├── prisma\
│   ├── dist\              # Compiled TypeScript (production)
│   ├── package.json
│   └── ...
├── data\
│   ├── database.db        # SQLite database
│   └── media\             # Uploaded images/videos
│       └── recipes\
│           └── {recipeId}\
│               ├── images\
│               └── videos\
└── logs\                  # Application logs (if using PM2)
```

### Development Mode (Recommended to Start)

This is the simplest way to run the app for development and personal use:

**1. Install Dependencies**
```powershell
# In backend directory
cd C:\Users\benno\Documents\GitHub\let-them-cook\backend
npm install

# In frontend directory
cd C:\Users\benno\Documents\GitHub\let-them-cook\frontend
npm install
```

**2. Set Up Database**
```powershell
# In backend directory
npx prisma generate
npx prisma migrate dev --name init
```

**3. Create Environment File**

Create `backend\.env`:
```env
NODE_ENV=development
PORT=3000
DATABASE_URL="file:C:/Users/benno/Documents/GitHub/let-them-cook/data/database.db"
MEDIA_STORAGE_PATH="C:/Users/benno/Documents/GitHub/let-them-cook/data/media"
```

**4. Run Development Servers**

Open two terminal windows:

**Terminal 1 - Backend:**
```powershell
cd C:\Users\benno\Documents\GitHub\let-them-cook\backend
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
cd C:\Users\benno\Documents\GitHub\let-them-cook\frontend
npm run dev
```

**5. Access the App**
- On your PC: `http://localhost:5173`
- On your phone (same WiFi): `http://192.168.1.X:5173`
  - Find your PC's IP: `ipconfig` in PowerShell, look for "IPv4 Address"
  - Allow through Windows Firewall when prompted

### Production Mode (Always-On Access)

For running the app 24/7 on your Windows PC:

#### Option 1: Using PM2 (Recommended)

**1. Build the Applications**
```powershell
# Build frontend
cd C:\Users\benno\Documents\GitHub\let-them-cook\frontend
npm run build

# Build backend
cd C:\Users\benno\Documents\GitHub\let-them-cook\backend
npm run build
```

**2. Create PM2 Configuration**

Create `backend\ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'let-them-cook-api',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'file:C:/Users/benno/Documents/GitHub/let-them-cook/data/database.db',
      MEDIA_STORAGE_PATH: 'C:/Users/benno/Documents/GitHub/let-them-cook/data/media'
    },
    error_file: 'C:/Users/benno/Documents/GitHub/let-them-cook/logs/api-error.log',
    out_file: 'C:/Users/benno/Documents/GitHub/let-them-cook/logs/api-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
```

**3. Start PM2**
```powershell
cd C:\Users\benno\Documents\GitHub\let-them-cook\backend
pm2 start ecosystem.config.js
pm2 save
```

**4. Install as Windows Service** (starts on boot)
```powershell
npm install -g pm2-windows-service
pm2-service-install
pm2-service-start
```

**5. Serve Frontend**

For production, you'll need a web server. Options:

**Option A: Use `serve` package (simple)**
```powershell
npm install -g serve
serve -s C:\Users\benno\Documents\GitHub\let-them-cook\frontend\dist -l 5173
```

**Option B: Use Nginx for Windows** (more robust)
- Download from https://nginx.org/en/download.html
- Extract to `C:\nginx`
- Configure `C:\nginx\conf\nginx.conf` (see below)

#### Option 2: Using Node.js Windows Service

Alternatively, create a Windows service without PM2:

```powershell
npm install -g node-windows
```

Create a service installer script (run as administrator).

### Nginx for Windows (Optional)

If you want a production-like setup with reverse proxy:

**1. Download & Extract**
- Download from https://nginx.org/en/download.html
- Extract to `C:\nginx`

**2. Configure** (`C:\nginx\conf\nginx.conf`)
```nginx
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    server {
        listen       80;
        server_name  localhost;

        # Frontend (React PWA)
        root   C:/Users/benno/Documents/GitHub/let-them-cook/frontend/dist;
        index  index.html;

        # Frontend routes (SPA fallback)
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API proxy
        location /api/ {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;

            # File upload size limit
            client_max_body_size 100M;
        }

        # Media files
        location /media/ {
            alias C:/Users/benno/Documents/GitHub/let-them-cook/data/media/;
            expires 30d;
        }
    }
}
```

**3. Run Nginx**
```powershell
cd C:\nginx
start nginx
```

**4. Manage Nginx**
```powershell
# Stop
nginx -s stop

# Reload config
nginx -s reload
```

### Network Configuration

#### Local Network Access
- Find your PC's IP address:
  ```powershell
  ipconfig
  ```
  Look for "IPv4 Address" (e.g., 192.168.1.100)
- Access from phone on same WiFi: `http://192.168.1.100:5173` (dev mode) or `http://192.168.1.100` (with Nginx)

#### Windows Firewall
Windows will prompt to allow Node.js through the firewall. Click "Allow access".

Or manually configure:
1. Windows Security → Firewall & network protection
2. Advanced settings → Inbound Rules → New Rule
3. Allow TCP ports 3000 (API) and 5173 (Vite dev server) or 80 (Nginx)

#### Power Settings (for 24/7 operation)
If you want the app always available:
1. Settings → System → Power
2. Screen and sleep → Never
3. (Optional) Disable hibernation: `powercfg /h off` in admin PowerShell

### Updating the Application

```powershell
# Pull latest changes
cd C:\Users\benno\Documents\GitHub\let-them-cook
git pull

# Update backend
cd backend
npm install
npx prisma migrate deploy  # If there are database changes
npm run build  # If running in production mode

# Update frontend
cd ..\frontend
npm install
npm run build  # If running in production mode

# Restart PM2 (if using)
pm2 restart all
```

---

## Data Flow & Architecture Diagrams

### High-Level Architecture
```
┌─────────────────────────────────────┐
│         Mobile Phone / Browser      │
│                                     │
│  ┌────────────────────────────┐    │
│  │     React PWA Frontend     │    │
│  │                            │    │
│  │  - Service Worker          │    │
│  │  - IndexedDB (offline)     │    │
│  │  - Wake Lock API           │    │
│  └────────────┬───────────────┘    │
└───────────────┼────────────────────┘
                │ HTTP (local network)
                │
┌───────────────▼────────────────────┐
│       Windows 11 PC                │
│                                    │
│  ┌──────────────────────────┐     │
│  │    Nginx (optional) or   │     │
│  │    Vite Dev Server       │     │
│  │  - Static file serving   │     │
│  │  - Reverse proxy         │     │
│  └──────────┬───────────────┘     │
│             │                      │
│  ┌──────────▼───────────────┐     │
│  │   Node.js + Express API  │     │
│  │   - Recipe parser        │     │
│  │   - Business logic       │     │
│  └──────────┬───────────────┘     │
│             │                      │
│  ┌──────────▼───────────────┐     │
│  │   SQLite Database        │     │
│  │   (via Prisma ORM)       │     │
│  └──────────────────────────┘     │
│                                    │
│  ┌──────────────────────────┐     │
│  │   Filesystem Storage     │     │
│  │   - Images               │     │
│  │   - Videos               │     │
│  └──────────────────────────┘     │
└────────────────────────────────────┘
```

### Offline-First Data Sync Flow
```
┌────────────────────────────────┐
│  User makes change offline    │
│  (edit recipe, create meal)   │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│  Store in IndexedDB locally    │
│  Mark as "pending sync"        │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│  Service Worker detects        │
│  network connectivity          │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│  Background Sync API triggers  │
│  sync to server                │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│  Server processes changes      │
│  Returns updated data          │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│  Update IndexedDB with         │
│  server response               │
└────────────────────────────────┘
```

---

## Development Workflow

### Local Development Environment

#### Prerequisites
- Node.js 20+ LTS (download from nodejs.org)
- npm (included with Node.js)
- Git for Windows
- SQLite3 CLI (optional, for database inspection)
- Windows Terminal or PowerShell

#### Project Setup (Windows)
```powershell
# Clone repository
git clone https://github.com/yourusername/let-them-cook.git
cd let-them-cook

# Backend setup
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init

# Create .env file
@"
NODE_ENV=development
PORT=3000
DATABASE_URL="file:C:/Users/benno/Documents/GitHub/let-them-cook/data/database.db"
MEDIA_STORAGE_PATH="C:/Users/benno/Documents/GitHub/let-them-cook/data/media"
"@ | Out-File -FilePath .env -Encoding utf8

# Start backend dev server
npm run dev  # Runs on http://localhost:3000

# In a new terminal: Frontend setup
cd ..\frontend
npm install
npm run dev  # Runs on http://localhost:5173
```

#### Development Stack
- **Backend Dev Server**: `tsx watch` or `nodemon` for hot reload
- **Frontend Dev Server**: Vite with HMR (Hot Module Replacement)
- **Database Migrations**: Prisma Migrate
- **Type Safety**: TypeScript across frontend and backend

#### Accessing from Mobile
1. Find your PC's IP: `ipconfig` in PowerShell
2. On phone (same WiFi): `http://192.168.1.X:5173`
3. Allow through Windows Firewall when prompted

### Production Build (Windows)

To test production build locally:

```powershell
# Build frontend
cd C:\Users\benno\Documents\GitHub\let-them-cook\frontend
npm run build

# Build backend
cd ..\backend
npm run build

# Start with PM2 (if installed)
pm2 start ecosystem.config.js

# Or run directly
node dist/index.js
```

---

## Future Migration Paths

### Windows PC → Dedicated Hardware (Raspberry Pi, Mini PC)

If you decide to move from your Windows PC to always-on dedicated hardware:

#### Raspberry Pi Deployment

**Hardware Options:**
- **Raspberry Pi 5** (4GB or 8GB) - Best performance, ~$80-120 with accessories
- **Raspberry Pi 4** (4GB) - Still excellent, ~$55-80 with accessories

**Migration Steps:**

1. **Set Up Raspberry Pi**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs

   # Install PM2
   sudo npm install -g pm2

   # Install Nginx
   sudo apt install -y nginx
   ```

2. **Transfer Application**
   ```bash
   # On Pi: Clone repository
   cd /home/pi
   git clone https://github.com/yourusername/let-them-cook.git
   cd let-them-cook

   # Install dependencies
   cd backend && npm install --production
   cd ../frontend && npm install && npm run build
   ```

3. **Transfer Data**
   ```bash
   # From Windows PC, copy database and media files
   # Option A: Use SCP
   scp C:\Users\benno\Documents\GitHub\let-them-cook\data\database.db pi@raspberrypi:/home/pi/let-them-cook/data/

   # Option B: Export/import via GitHub or USB drive
   ```

4. **Configure Nginx** (use the config from earlier Pi deployment section)

5. **Set Up PM2**
   ```bash
   cd /home/pi/let-them-cook/backend
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup  # Auto-start on boot
   ```

**Key Benefits:**
- 24/7 availability without keeping PC running
- Low power consumption (~5-10W vs 50-200W for PC)
- Dedicated hardware = can restart PC freely
- ~$1/month electricity vs ~$5-15/month for PC

**Code Changes Required:** None! The application is cross-platform.

**Environment Variable Changes:**
```bash
# Update .env to use Linux paths
DATABASE_URL="file:/home/pi/let-them-cook/data/database.db"
MEDIA_STORAGE_PATH="/home/pi/let-them-cook/data/media"
```

---

## Additional Migration Paths

### Database Migration (SQLite → PostgreSQL)
When ready to scale:
1. Update Prisma schema datasource:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Export SQLite data, import to PostgreSQL
3. Run `prisma migrate` to update schema
4. No application code changes needed (thanks to Prisma abstraction)

### Storage Migration (Filesystem → S3)
1. Implement `S3StorageProvider` class
2. Update environment configuration to use S3 provider
3. Migrate existing files to S3
4. No route changes needed (abstraction layer handles it)

### Hosting Migration (Windows/Pi → Cloud)
Options when ready to scale or need more reliability:
- **Railway**, **Fly.io**, **Render** - Simple Node.js deployment ($5-10/month)
- **AWS EC2** or **DigitalOcean Droplet** - VPS similar to Pi setup ($5-20/month)
- **Vercel** (frontend) + **Railway** (backend) - Serverless frontend, hosted backend
- All options work the same way - deploy from GitHub, set environment variables

---

## Security Considerations

### Current (Single-User)
- Local network only (no authentication needed initially)
- Input validation via Zod
- Parameterized queries via Prisma (SQL injection protection)
- File upload validation (file type, size limits)

### Future (Multi-User)
- JWT-based authentication
- Password hashing (bcrypt)
- Rate limiting (express-rate-limit)
- CORS configuration
- HTTPS required
- CSP (Content Security Policy) headers

---

## Performance Considerations

### Backend Optimizations
- **Image Optimization**: Compress images on upload (sharp library)
- **Video Handling**:
  - Store original videos
  - Consider not transcoding (let browser handle)
  - Or offload transcoding to client
- **Database Indexing**: Index frequently queried fields (recipe title, ingredients)
- **Lazy Loading**: Load images/videos on demand
- **Pagination**: For recipe lists (e.g., 20 recipes per page)

### Frontend Optimizations
- **Code Splitting**: Lazy load routes and components
- **Image Lazy Loading**: Native `loading="lazy"` attribute
- **Service Worker Caching**: Cache static assets aggressively
- **Bundle Size**: Monitor with `vite-bundle-visualizer`

---

## Testing Strategy

### Frontend
- **Unit Tests**: Vitest + React Testing Library
- **E2E Tests**: Playwright (test PWA features, offline mode)

### Backend
- **Unit Tests**: Vitest or Jest
- **Integration Tests**: Test API endpoints with supertest
- **Database Tests**: Use in-memory SQLite for tests

### Manual Testing
- Test offline mode thoroughly
- Test on actual mobile devices
- Test accessing from phone over local WiFi

---

## Summary of Key Technologies

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend Framework** | React 18+ | UI components |
| **Build Tool** | Vite | Development and production builds |
| **Styling** | Tailwind CSS | Responsive, mobile-first design |
| **State Management** | React Query + Zustand | Server and client state |
| **Offline Storage** | IndexedDB (Dexie.js) | Local data persistence |
| **Service Worker** | Workbox | Offline caching and sync |
| **Backend Runtime** | Node.js 20+ | JavaScript server |
| **Backend Framework** | Express.js | REST API |
| **Database** | SQLite | Embedded database |
| **ORM** | Prisma | Type-safe database access |
| **Validation** | Zod | Runtime type checking |
| **Web Scraping** | Cheerio | Recipe import from websites |
| **PDF Parsing** | pdf-parse | Recipe import from PDFs |
| **OCR** | Tesseract.js | Recipe import from images |
| **Process Manager** | PM2 (optional) | Keep Node.js app running |
| **Web Server** | Nginx (optional) or Vite | Static files and reverse proxy |
| **Operating System** | Windows 11 | Primary development and hosting platform |

This architecture provides a solid foundation for v1 while maintaining flexibility for future enhancements and scaling.

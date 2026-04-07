import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create a temporary test database for each test run
const testDbDir = path.join(__dirname, '..', '..', 'test-data');
const testDbName = `test-${randomUUID().slice(0, 8)}.db`;
const testDbPath = path.join(testDbDir, testDbName);

// Set environment variables before any imports that use them
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.MEDIA_STORAGE_PATH = path.join(testDbDir, 'media');

beforeAll(() => {
  // Ensure test-data directory exists
  if (!existsSync(testDbDir)) {
    mkdirSync(testDbDir, { recursive: true });
  }

  // Push schema to test database (faster than running migrations)
  execSync('npx prisma db push', {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    stdio: 'pipe',
  });
});

afterAll(() => {
  // Clean up test database
  try {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }
    // Also clean up journal files
    const journalPath = `${testDbPath}-journal`;
    if (existsSync(journalPath)) {
      rmSync(journalPath, { force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
});

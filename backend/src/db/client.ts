import { PrismaClient } from '@prisma/client'

// Single shared instance — avoids exhausting SQLite's connection handling by
// creating a new client per import (a common footgun with hot-reload dev
// servers). Phase 4 swaps DATABASE_URL to point at the VPS Postgres instance;
// nothing here changes.
export const prisma = new PrismaClient()

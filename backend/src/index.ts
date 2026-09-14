import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import * as bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { Pool } from '@neondatabase/serverless';

// Define Cloudflare Env Bindings
export type Bindings = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  MASAR_BACKEND_URL: string;
  MASAR_SHARED_SECRET: string;
};

// Check for missing required environment variables in Cloudflare Pages / Workers
function checkEnv(c: any, required: (keyof Bindings)[]) {
  const missing = required.filter(k => !c.env || !c.env[k]);
  if (missing.length > 0) {
    return c.json({
      error: `Missing environment variable(s): ${missing.join(', ')}. Note: If you just added them in the Cloudflare Dashboard, you MUST trigger a new deployment for them to take effect.`
    }, 500);
  }
  return null;
}

function getPool(c: any) {
  return new Pool({ connectionString: c.env.DATABASE_URL });
}

async function closePool(c: any, pool: Pool) {
  try {
    if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
      c.executionCtx.waitUntil(pool.end());
    } else {
      await pool.end();
    }
  } catch {}
}

async function ensureAdminUsersTable(pool: Pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM admin_users');
    if (parseInt(rows[0].count) === 0) {
      const hash = await bcrypt.hash('MasarAdmin2026!', 10);
      await pool.query(
        'INSERT INTO admin_users (id, email, password_hash) VALUES ($1, $2, $3)',
        ['admin-1', 'admin@masar.com', hash]
      );
    }
  } catch (err) {
    console.error('ensureAdminUsersTable error:', err);
  }
}

// Authentication Middleware
async function requireAuth(c: any, next: any) {
  const token = getCookie(c, 'admin_session');
  if (!token) {
    return c.json({ error: 'Unauthorized: No session token found' }, 401);
  }

  const envErr = checkEnv(c, ['JWT_SECRET']);
  if (envErr) return envErr;

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    c.set('user', payload);
    await next();
  } catch (e) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }
}

// Sub-router for all API actions
const api = new Hono<{ Bindings: Bindings }>();

// --- Health Check ---
api.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// --- Auth Routes ---

api.post('/auth/login', async (c) => {
  const envErr = checkEnv(c, ['DATABASE_URL', 'JWT_SECRET']);
  if (envErr) return envErr;

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { email, password } = body || {};
  if (!email || !password) {
    return c.json({ error: 'Missing email or password' }, 400);
  }

  const pool = getPool(c);
  try {
    await ensureAdminUsersTable(pool);
    const { rows } = await pool.query('SELECT * FROM admin_users WHERE email = $1', [email]);
    const user = rows[0] as any;

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const jwt = await new jose.SignJWT({ id: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    setCookie(c, 'admin_session', jwt, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return c.json({ message: 'Logged in successfully', user: { id: user.id, email: user.email } });
  } catch (dbErr: any) {
    console.error('Login DB error:', dbErr);
    return c.json({ error: `Database error: ${dbErr?.message || 'Failed to connect'}` }, 500);
  } finally {
    await closePool(c, pool);
  }
});

api.post('/auth/logout', async (c) => {
  setCookie(c, 'admin_session', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 0,
    path: '/',
  });
  return c.json({ message: 'Logged out' });
});

api.get('/auth/me', async (c) => {
  const token = getCookie(c, 'admin_session');
  if (!token) return c.json({ user: null });

  if (!c.env?.JWT_SECRET) return c.json({ user: null });

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    return c.json({ user: payload });
  } catch (e) {
    return c.json({ user: null });
  }
});

// --- Admin Users Management ---

api.get('/admin-users', requireAuth, async (c) => {
  const envErr = checkEnv(c, ['DATABASE_URL']);
  if (envErr) return envErr;

  const pool = getPool(c);
  try {
    await ensureAdminUsersTable(pool);
    const { rows } = await pool.query('SELECT id, email, created_at FROM admin_users ORDER BY created_at DESC');
    return c.json(rows);
  } catch (e: any) {
    return c.json({ error: e.message || 'Failed to fetch admin users' }, 500);
  } finally {
    await closePool(c, pool);
  }
});

api.post('/admin-users', requireAuth, async (c) => {
  const envErr = checkEnv(c, ['DATABASE_URL']);
  if (envErr) return envErr;

  const { email, password } = await c.req.json().catch(() => ({}));
  if (!email || !password) return c.json({ error: 'Missing email or password' }, 400);

  const hash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();

  const pool = getPool(c);
  try {
    await ensureAdminUsersTable(pool);
    await pool.query(
      'INSERT INTO admin_users (id, email, password_hash, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
      [id, email, hash]
    );
    return c.json({ message: 'Admin created', id }, 201);
  } catch (e: any) {
    if (e.code === '23505') return c.json({ error: 'Email already exists' }, 400);
    return c.json({ error: e.message || 'Database error' }, 500);
  } finally {
    await closePool(c, pool);
  }
});

api.delete('/admin-users/:id', requireAuth, async (c) => {
  const envErr = checkEnv(c, ['DATABASE_URL']);
  if (envErr) return envErr;

  const idToDelete = c.req.param('id');
  const currentUser: any = c.get('user');

  if (currentUser?.id === idToDelete) {
    return c.json({ error: 'Cannot delete yourself' }, 400);
  }

  const pool = getPool(c);
  try {
    await ensureAdminUsersTable(pool);
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM admin_users');
    if (parseInt(rows[0].count) <= 1) {
      return c.json({ error: 'Cannot delete the last admin' }, 400);
    }

    await pool.query('DELETE FROM admin_users WHERE id = $1', [idToDelete]);
    return c.json({ message: 'Admin deleted' });
  } catch (e: any) {
    return c.json({ error: e.message || 'Database error' }, 500);
  } finally {
    await closePool(c, pool);
  }
});

// --- Proxied Routes to Masar_Backend ---

async function proxyToMasarBackend(c: any, targetPath: string) {
  const envErr = checkEnv(c, ['MASAR_BACKEND_URL', 'MASAR_SHARED_SECRET']);
  if (envErr) return envErr;

  const url = `${c.env.MASAR_BACKEND_URL}/admin${targetPath}`;
  const headers: Record<string, string> = {
    'X-Admin-Secret': c.env.MASAR_SHARED_SECRET,
    'Content-Type': 'application/json',
  };

  let body: any = undefined;
  if (!['GET', 'HEAD'].includes(c.req.method)) {
    try {
      body = await c.req.text();
    } catch {}
  }

  try {
    const response = await fetch(url, {
      method: c.req.method,
      headers,
      body: body ? body : undefined,
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json().catch(() => ({}));
      return c.json(data, response.status as any);
    } else {
      const text = await response.text();
      return c.text(text, response.status as any);
    }
  } catch (err: any) {
    return c.json({ error: `Failed to proxy request to backend: ${err.message}` }, 502);
  }
}

// Proxy routes for orgs
api.all('/orgs', requireAuth, (c) => proxyToMasarBackend(c, '/orgs'));
api.all('/orgs/*', requireAuth, (c) => {
  const fullPath = c.req.path;
  const match = fullPath.match(/\/orgs(\/.*)?$/);
  const targetPath = match ? `/orgs${match[1] || ''}` : '/orgs';
  return proxyToMasarBackend(c, targetPath);
});

// Proxy routes for proposals
api.all('/proposals', requireAuth, (c) => proxyToMasarBackend(c, '/proposals'));
api.all('/proposals/*', requireAuth, (c) => {
  const fullPath = c.req.path;
  const match = fullPath.match(/\/proposals(\/.*)?$/);
  const targetPath = match ? `/proposals${match[1] || ''}` : '/proposals';
  return proxyToMasarBackend(c, targetPath);
});

// --- Main Root App ---
const app = new Hono<{ Bindings: Bindings }>();

// CORS middleware allowing credentials and all valid origins
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*';
    return origin;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret'],
}));

// Mount the API routes at /api, /, and /admin for full multi-environment compatibility
app.route('/api', api);
app.route('/', api);
app.route('/admin', api);

export default app;

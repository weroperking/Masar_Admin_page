import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import * as bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { Pool } from '@neondatabase/serverless';

// Define Cloudflare Env
type Bindings = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  MASAR_BACKEND_URL: string;
  MASAR_SHARED_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({
  origin: ['http://localhost:3000', 'https://admin.masar.top'],
  credentials: true,
}));

// Auth Middleware
app.use('/admin/*', async (c, next) => {
  const token = getCookie(c, 'admin_session');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    c.set('user', payload);
    await next();
  } catch (e) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// --- Auth Routes ---

app.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: 'Missing credentials' }, 400);

  const pool = new Pool({ connectionString: c.env.DATABASE_URL });
  try {
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

    return c.json({ message: 'Logged in successfully' });
  } finally {
    c.executionCtx.waitUntil(pool.end());
  }
});

app.post('/auth/logout', async (c) => {
  setCookie(c, 'admin_session', '', { maxAge: 0, path: '/' });
  return c.json({ message: 'Logged out' });
});

app.get('/auth/me', async (c) => {
  const token = getCookie(c, 'admin_session');
  if (!token) return c.json({ user: null });

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    return c.json({ user: payload });
  } catch (e) {
    return c.json({ user: null });
  }
});

// --- Admin Users Management ---

app.get('/admin/admin-users', async (c) => {
  const pool = new Pool({ connectionString: c.env.DATABASE_URL });
  try {
    const { rows } = await pool.query('SELECT id, email, created_at FROM admin_users ORDER BY created_at DESC');
    return c.json(rows);
  } finally {
    c.executionCtx.waitUntil(pool.end());
  }
});

app.post('/admin/admin-users', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: 'Missing email or password' }, 400);

  const hash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();

  const pool = new Pool({ connectionString: c.env.DATABASE_URL });
  try {
    await pool.query(
      'INSERT INTO admin_users (id, email, password_hash, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
      [id, email, hash]
    );
    return c.json({ message: 'Admin created', id }, 201);
  } catch (e: any) {
    if (e.code === '23505') return c.json({ error: 'Email already exists' }, 400);
    return c.json({ error: 'Database error' }, 500);
  } finally {
    c.executionCtx.waitUntil(pool.end());
  }
});

app.delete('/admin/admin-users/:id', async (c) => {
  const idToDelete = c.req.param('id');
  const currentUser: any = c.get('user');

  if (currentUser.id === idToDelete) {
    return c.json({ error: 'Cannot delete yourself' }, 400);
  }

  const pool = new Pool({ connectionString: c.env.DATABASE_URL });
  try {
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM admin_users');
    if (parseInt(rows[0].count) <= 1) {
      return c.json({ error: 'Cannot delete the last admin' }, 400);
    }

    await pool.query('DELETE FROM admin_users WHERE id = $1', [idToDelete]);
    return c.json({ message: 'Admin deleted' });
  } finally {
    c.executionCtx.waitUntil(pool.end());
  }
});

// --- Proxied Routes to Masar_Backend ---

async function proxyToMasarBackend(c: any, path: string, method: string = 'GET', body?: any) {
  const url = `${c.env.MASAR_BACKEND_URL}/admin${path}`;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': c.env.MASAR_SHARED_SECRET,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json().catch(() => null);
    return c.json(data || {}, response.status);
  } catch (err) {
    return c.json({ error: 'Failed to proxy request to backend' }, 502);
  }
}

app.all('/admin/orgs/*', async (c) => {
  const path = c.req.path.replace('/admin/orgs', '/orgs');
  let body;
  if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
    body = await c.req.json().catch(() => undefined);
  }
  return proxyToMasarBackend(c, path, c.req.method, body);
});

app.all('/admin/orgs', async (c) => proxyToMasarBackend(c, '/orgs', c.req.method));

app.all('/admin/proposals/*', async (c) => {
  const path = c.req.path.replace('/admin/proposals', '/proposals');
  let body;
  if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
    body = await c.req.json().catch(() => undefined);
  }
  return proxyToMasarBackend(c, path, c.req.method, body);
});

app.all('/admin/proposals', async (c) => proxyToMasarBackend(c, '/proposals', c.req.method));

export default app;

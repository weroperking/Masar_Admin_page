import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import * as jose from 'jose';
import crypto from 'crypto';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Required for neon serverless in Node.js environment
neonConfig.webSocketConstructor = ws;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Environment variables
  const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-preview-only';
  const DB_URL = process.env.DATABASE_URL || '';
  const MASAR_BACKEND_URL = process.env.MASAR_BACKEND_URL || '';
  const MASAR_SHARED_SECRET = process.env.MASAR_SHARED_SECRET || '';

  const pool = new Pool({ connectionString: DB_URL });

  // Ensure table exists and seed a default admin if empty
  if (DB_URL) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id UUID PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      const { rows } = await pool.query('SELECT COUNT(*) FROM admin_users');
      if (rows[0].count === '0') {
        const hash = bcrypt.hashSync('password123', 10);
        await pool.query(
          'INSERT INTO admin_users (id, email, password_hash) VALUES ($1, $2, $3)',
          [crypto.randomUUID(), 'admin@masar.top', hash]
        );
        console.log('Seeded default admin user: admin@masar.top / password123');
      }
    } catch (e) {
      console.error('Failed to initialize database schema:', e);
    }
  }

  app.use(express.json());
  app.use(cookieParser());

  // --- Auth Middleware ---
  const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.cookies.admin_session;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jose.jwtVerify(token, secret);
      (req as any).user = payload;
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  const apiRouter = express.Router();

  // --- Auth Routes ---
  apiRouter.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
      const { rows } = await pool.query('SELECT * FROM admin_users WHERE email = $1', [email]);
      const user = rows[0];

      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const secret = new TextEncoder().encode(JWT_SECRET);
      const jwt = await new jose.SignJWT({ id: user.id, email: user.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);

      res.cookie('admin_session', jwt, { 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none', 
        maxAge: 60 * 60 * 24 * 1000, 
        path: '/' 
      });
      res.json({ message: 'Logged in successfully' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Database error' });
    }
  });

  apiRouter.post('/auth/logout', (req, res) => {
    res.clearCookie('admin_session');
    res.json({ message: 'Logged out' });
  });

  apiRouter.get('/auth/me', async (req, res) => {
    const token = req.cookies.admin_session;
    if (!token) return res.json({ user: null });
    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jose.jwtVerify(token, secret);
      res.json({ user: payload });
    } catch (e) {
      res.json({ user: null });
    }
  });

  // --- Admin Users Management ---
  apiRouter.get('/admin-users', authMiddleware, async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT id, email, created_at FROM admin_users ORDER BY created_at DESC');
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch admins' });
    }
  });

  apiRouter.post('/admin-users', authMiddleware, async (req, res) => {
    const { email, password } = req.body;
    
    try {
      const hash = bcrypt.hashSync(password, 10);
      const id = crypto.randomUUID();
      await pool.query(
        'INSERT INTO admin_users (id, email, password_hash) VALUES ($1, $2, $3)',
        [id, email, hash]
      );
      res.status(201).json({ message: 'Created', id });
    } catch (e: any) {
      if (e.code === '23505') return res.status(400).json({ error: 'Email exists' });
      res.status(500).json({ error: 'Database error' });
    }
  });

  apiRouter.delete('/admin-users/:id', authMiddleware, async (req, res) => {
    const id = req.params.id;
    if ((req as any).user.id === id) return res.status(400).json({ error: 'Cannot delete yourself' });
    
    try {
      const countRes = await pool.query('SELECT COUNT(*) FROM admin_users');
      if (parseInt(countRes.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Cannot delete last admin' });
      }
      
      await pool.query('DELETE FROM admin_users WHERE id = $1', [id]);
      res.json({ message: 'Deleted' });
    } catch (e) {
      res.status(500).json({ error: 'Database error' });
    }
  });

  // --- Proxied Routes to Masar_Backend ---
  async function proxyRequest(req: express.Request, res: express.Response, targetPath: string) {
    if (!MASAR_BACKEND_URL) return res.status(500).json({ error: 'Backend URL not configured' });
    
    const url = `${MASAR_BACKEND_URL}/admin${targetPath}`;
    const headers: any = {
      'X-Admin-Secret': MASAR_SHARED_SECRET,
      'Content-Type': 'application/json'
    };
    
    try {
      const fetchRes = await fetch(url, {
        method: req.method,
        headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
      });
      
      const data = await fetchRes.json().catch(() => null);
      res.status(fetchRes.status).json(data || {});
    } catch (err) {
      console.error('Proxy error:', err);
      res.status(502).json({ error: 'Failed to proxy request to backend' });
    }
  }

  apiRouter.all('/orgs*', authMiddleware, (req, res) => proxyRequest(req, res, req.path.replace(/^\/orgs/, '/orgs')));
  apiRouter.all('/proposals*', authMiddleware, (req, res) => proxyRequest(req, res, req.path.replace(/^\/proposals/, '/proposals')));

  app.use('/api', apiRouter);

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

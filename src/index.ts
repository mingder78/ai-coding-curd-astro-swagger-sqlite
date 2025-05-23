// src/index.ts
import { Elysia, t } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { jwt } from '@elysiajs/jwt';
import { cors } from '@elysiajs/cors';
import { Database } from 'bun:sqlite';
// Generated with CLI
import { getXataClient, DatabaseSchema } from "./xata";
import { Kysely } from "kysely";
import { XataDialect, Model } from "@xata.io/kysely";

const xata = getXataClient();

const db2 = new Kysely<Model<DatabaseSchema>>({
  dialect: new XataDialect({ xata }),
});
const page = await xata.db.users.getAll();
console.log(page);

// Initialize SQLite database
const db = new Database('app.db');
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Types for our data models
const UserSchema = t.Object({
  id: t.Optional(t.Number()),
  username: t.String(),
  password: t.String()
});

const ItemSchema = t.Object({
  id: t.Optional(t.Number()),
  name: t.String(),
  description: t.Optional(t.String()),
  user_id: t.Optional(t.Number()),
  created_at: t.Optional(t.String())
});

const LoginSchema = t.Object({
  username: t.String(),
  password: t.String()
});

const logPlugin = new Elysia({
  name: "logPlugin",
}).decorate("log", (message: string) => {
  console.log(`[LOG]: ${message}`);
});

const app = new Elysia()
  // Add Swagger documentation
  .use(swagger({
    documentation: {
      info: {
        title: 'CRUD API with Authentication',
        version: '1.0.0',
        description: 'A CRUD API with JWT authentication, rate limiting, and Swagger UI'
      },
      tags: [
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Items', description: 'CRUD operations for items' }
      ]
    }
  }))
  // Add JWT authentication
  .use(jwt({
    name: 'jwt',
    secret: 'your-secret-key-change-this-in-production'
  }))
  // Add CORS support
  .use(cors())
  // Add rate limiting
  .use(logPlugin)
  .group('/ping', app => app
    .get("/", (ctx) => {
      ctx.log(JSON.stringify(Object.keys(ctx)));
      const { authorization, ...newObj } = ctx.headers;
      console.log(newObj)
      return "Check your console!";
    }))
  // Define auth middleware
  .derive(({ jwt, headers, set }) => {
    return {
      isAuthenticated: async () => {
        const authHeader = headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          set.status = 401;
          return false;
        }

        const token = authHeader.split(' ')[1];
        const payload = await jwt.verify(token);

        if (!payload) {
          set.status = 401;
          return false;
        }

        return payload;
      }
    };
  })
  // Auth routes
  .group('/auth', app => app
    .post('/register',
      async ({ body }) => {
        const { username, password } = body;

        try {
          const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
          const result = stmt.run(username, password); // Note: In production, hash passwords!

          return {
            success: true,
            id: result.lastInsertRowid
          };
        } catch (error) {
          return {
            success: false,
            error: 'Username already exists'
          };
        }
      },
      {
        body: UserSchema,
        detail: {
          tags: ['Auth'],
          summary: 'Register a new user',
          description: 'Create a new user account'
        }
      }
    )
    .post('/login',
      async ({ body, jwt }) => {
        const { username, password } = body;

        const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?')
          .get(username, password); // Note: In production, verify hashed passwords!

        if (!user) {
          return {
            success: false,
            message: 'Invalid credentials'
          };
        }

        const token = await jwt.sign({
          id: user.id,
          username: user.username
        });

        return {
          success: true,
          token
        };
      },
      {
        body: LoginSchema,
        detail: {
          tags: ['Auth'],
          summary: 'User login',
          description: 'Authenticate a user and generate an access token'
        }
      }
    )
  )
  // Item routes
  .group('/items', app => app
    .get('/',
      async ({ isAuthenticated }) => {
        const auth = await isAuthenticated();
        if (!auth) return { error: 'Unauthorized' };

        const items = db.prepare('SELECT * FROM items WHERE user_id = ?').all(auth.id);
        return items;
      },
      {
        detail: {
          tags: ['Items'],
          summary: 'Get all items',
          description: 'Retrieve all items belonging to the authenticated user',
          security: [{ bearerAuth: [] }]
        }
      }
    )
    .get('/:id',
      async ({ params, isAuthenticated }) => {
        const auth = await isAuthenticated();
        if (!auth) return { error: 'Unauthorized' };

        const item = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?')
          .get(params.id, auth.id);

        if (!item) {
          return {
            success: false,
            message: 'Item not found'
          };
        }

        return item;
      },
      {
        params: t.Object({
          id: t.Numeric()
        }),
        detail: {
          tags: ['Items'],
          summary: 'Get item by ID',
          description: 'Retrieve a specific item by its ID',
          security: [{ bearerAuth: [] }]
        }
      }
    )
    .post('/',
      async ({ body, isAuthenticated }) => {
        const auth = await isAuthenticated();
        if (!auth) return { error: 'Unauthorized' };

        const { name, description } = body;

        const stmt = db.prepare('INSERT INTO items (name, description, user_id) VALUES (?, ?, ?)');
        const result = stmt.run(name, description, auth.id);

        return {
          success: true,
          id: result.lastInsertRowid,
          name,
          description,
          user_id: auth.id
        };
      },
      {
        body: ItemSchema,
        detail: {
          tags: ['Items'],
          summary: 'Create item',
          description: 'Create a new item',
          security: [{ bearerAuth: [] }]
        }
      }
    )
    .put('/:id',
      async ({ params, body, isAuthenticated }) => {
        const auth = await isAuthenticated();
        if (!auth) return { error: 'Unauthorized' };

        const { name, description } = body;

        // First check if the item exists and belongs to the user
        const existingItem = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?')
          .get(params.id, auth.id);

        if (!existingItem) {
          return {
            success: false,
            message: 'Item not found or unauthorized'
          };
        }

        const stmt = db.prepare('UPDATE items SET name = ?, description = ? WHERE id = ? AND user_id = ?');
        stmt.run(name, description, params.id, auth.id);

        return {
          success: true,
          id: Number(params.id),
          name,
          description,
          user_id: auth.id
        };
      },
      {
        params: t.Object({
          id: t.Numeric()
        }),
        body: ItemSchema,
        detail: {
          tags: ['Items'],
          summary: 'Update item',
          description: 'Update an existing item',
          security: [{ bearerAuth: [] }]
        }
      }
    )
    .delete('/:id',
      async ({ params, isAuthenticated }) => {
        const auth = await isAuthenticated();
        if (!auth) return { error: 'Unauthorized' };

        // First check if the item exists and belongs to the user
        const existingItem = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?')
          .get(params.id, auth.id);

        if (!existingItem) {
          return {
            success: false,
            message: 'Item not found or unauthorized'
          };
        }

        const stmt = db.prepare('DELETE FROM items WHERE id = ? AND user_id = ?');
        stmt.run(params.id, auth.id);

        return {
          success: true,
          message: 'Item deleted successfully'
        };
      },
      {
        params: t.Object({
          id: t.Numeric()
        }),
        detail: {
          tags: ['Items'],
          summary: 'Delete item',
          description: 'Delete an existing item',
          security: [{ bearerAuth: [] }]
        }
      }
    )
  )
  .listen(3000);

console.log(`🦊 Elysia server is running at http://${app.server?.hostname}:${app.server?.port}`);
console.log(`📚 Swagger UI available at http://localhost:3000/ping`);
// src/index.ts
import { Elysia, t } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { jwt } from '@elysiajs/jwt';
import { cors } from '@elysiajs/cors';
import { Database } from 'bun:sqlite';
// Generated with CLI
import { getXataClient, type DatabaseSchema } from "./xata";
import { Kysely } from "kysely";
import { XataDialect, type Model } from "@xata.io/kysely";

const RP_NAME = import.meta.env.RP_NAME || 'YourAppName';
const RP_ID = import.meta.env.RP_ID || 'localhost';
const ORIGIN = import.meta.env.ORIGIN || 'http://localhost:3000';

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
        { name: 'Items', description: 'CRUD operations for items' },
        { name: 'Test', description: 'For testing' }
      ]
    }
  }))
  // Add JWT authentication
  .use(jwt({
    name: 'jwt',
    secret: import.meta.env.JWT_SECRET!
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
      return "PONG";
    }, {
      detail: {
        tags: ['Test'],
        summary: 'Ping',
        description: 'return PONG'
      }
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
  // Registration: Generate options
  .post(
    '/register/options',
    async ({ body: { email } }) => {
      const user = await xata.db.Users.createOrUpdate({ email, userHandle: crypto.randomUUID() });
      const credentials = await xata.db.Credentials.filter({ userId: user.id }).getMany();
      const challenge = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: user.userHandle,
        userName: email,
        attestationType: 'none',
        excludeCredentials: credentials.map((cred) => ({
          id: base64url.decode(cred.credentialID),
          type: 'public-key',
          transports: cred.transports || [],
        })),
      });

      // Store challenge temporarily (e.g., in Xata or in-memory)
      await xata.db.Users.update(user.id, { challenge: challenge.challenge });

      return challenge;
    },
    { body: t.Object({ email: t.String({ format: 'email' }) }) }
  )
  // Registration: Verify response
  .post(
    '/register/verify',
    async ({ body: { email, response } }) => {
      const user = await xata.db.Users.filter({ email }).getFirst();
      if (!user || !user.challenge) {
        throw new Error('User or challenge not found');
      }

      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: user.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
      });

      if (verification.verified) {
        await xata.db.Credentials.create({
          credentialID: base64url.encode(verification.registrationInfo!.credentialID),
          publicKey: verification.registrationInfo!.credentialPublicKey.toString('base64'),
          counter: verification.registrationInfo!.counter,
          userId: user.id,
          transports: response.transports || [],
        });

        // Clear challenge
        await xata.db.Users.update(user.id, { challenge: null });

        // Generate JWT
        const token = await app.jwt.sign({ userId: user.id, email });
        return { verified: true, token };
      }

      throw new Error('Registration failed');
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        response: t.Any(), // WebAuthn response is complex; use Any for simplicity
      }),
    }
  )
  // Authentication: Generate options
  .post(
    '/login/options',
    async ({ body: { email } }) => {
      const user = await xata.db.Users.filter({ email }).getFirst();
      if (!user) {
        throw new Error('User not found');
      }

      const credentials = await xata.db.Credentials.filter({ userId: user.id }).getMany();
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: credentials.map((cred) => ({
          id: base64url.decode(cred.credentialID),
          type: 'public-key',
          transports: cred.transports || [],
        })),
      });

      // Store challenge
      await xata.db.Users.update(user.id, { challenge: options.challenge });

      return options;
    },
    { body: t.Object({ email: t.String({ format: 'email' }) }) }
  )
  // Authentication: Verify response
  .post(
    '/login/verify',
    async ({ body: { email, response } }) => {
      const user = await xata.db.Users.filter({ email }).getFirst();
      if (!user || !user.challenge) {
        throw new Error('User or challenge not found');
      }

      const credential = await xata.db.Credentials
        .filter({ credentialID: base64url.encode(response.rawId) })
        .getFirst();

      if (!credential) {
        throw new Error('Credential not found');
      }

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: user.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        authenticator: {
          credentialID: base64url.decode(credential.credentialID),
          credentialPublicKey: Buffer.from(credential.publicKey, 'base64'),
          counter: credential.counter,
        },
      });

      if (verification.verified) {
        // Update counter
        await xata.db.Credentials.update(credential.id, {
          counter: verification.authenticationInfo.newCounter,
        });

        // Clear challenge
        await xata.db.Users.update(user.id, { challenge: null });

        // Generate JWT
        const token = await app.jwt.sign({ userId: user.id, email });
        return { verified: true, token };
      }

      throw new Error('Authentication failed');
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        response: t.Any(),
      }),
    }
  )
  .listen(3000);

console.log(`🦊 Elysia server is running at http://${app.server?.hostname}:${app.server?.port}`);
console.log(`📚 Swagger UI available at http://localhost:3000/swagger`);
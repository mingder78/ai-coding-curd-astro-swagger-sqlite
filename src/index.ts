// src/index.ts
import { Elysia, t } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { jwt } from '@elysiajs/jwt';
import { cors } from '@elysiajs/cors';
// Generated with CLI
import { getXataClient, type DatabaseSchema } from "./xata";
import { Kysely } from "kysely";
import { XataDialect, type Model } from "@xata.io/kysely";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifyRegistrationResponseOpts,
} from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import base64url from 'base64url';

const xata = getXataClient();

const RP_NAME = import.meta.env.RP_NAME || 'YourAppName';
const RP_ID = import.meta.env.RP_ID || 'localhost';
const ORIGIN = import.meta.env.ORIGIN || 'http://localhost:3000';

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
  .post(
    '/register/options',
    async ({ body: { email } }) => {
      const user = await xata.db.users.createOrUpdate({ email, userHandle: crypto.randomUUID() });
      const credentials = await xata.db.credentials.filter({ userId: user.id }).getMany();
      const challenge = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: isoUint8Array.fromUTF8String('customUserIDHere'), //user.userHandle,
        userName: email,
        attestationType: 'none',
        excludeCredentials: credentials.map((cred) => ({
          id: base64url.decode(cred.credentialID || ""),
          type: 'public-key',
          transports: cred.transports || [],
        })),
      });
      // Store challenge temporarily (e.g., in Xata or in-memory)
      await xata.db.users.update(user.id, { challenge: challenge.challenge });

      return challenge;
    },
    { body: t.Object({ email: t.String({ format: 'email' }) }) }
  )
  // Registration: Verify response
  .post(
    '/register/verify',
    async ({ body: { email, response } }) => {
      console.log(response)
      const user = await xata.db.users.filter({ email }).getFirst();
      if (!user || !user.challenge) {
        throw new Error('User or challenge not found');
      }
      let verification: VerifiedRegistrationResponse;
      try {
        const opts: VerifyRegistrationResponseOpts = {
          response,
          expectedChallenge: user.challenge,
          expectedOrigin: ORIGIN,
          expectedRPID: RP_ID,
          requireUserVerification: false,
        };
        verification = await verifyRegistrationResponse(opts);
        console.log(verification.verified)
        console.log('verification.verified')
      } catch (error) {
        const _error = error as Error;
        console.error(_error);
        return { error: _error.message };
      }
      if (verification.verified) {
        await xata.db.credentials.create({
          credentialID: base64url.encode(verification.registrationInfo!.credentialID),
          publicKey: verification.registrationInfo!.credentialPublicKey.toString('base64'),
          counter: verification.registrationInfo!.counter,
          userId: user.id,
          transports: response.transports || [],
        });

        // Clear challenge
        await xata.db.users.update(user.id, { challenge: null });

        // Generate JWT
        const token = await app.jwt.sign({ userId: user.id, email });
        return { verified: true, token };
      }
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
      const user = await xata.db.users.filter({ email }).getFirst();
      if (!user) {
        throw new Error('User not found');
      }

      const credentials = await xata.db.credentials.filter({ userId: user.id }).getMany();
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: credentials.map((cred) => ({
          id: base64url.decode(cred.credentialID),
          type: 'public-key',
          transports: cred.transports || [],
        })),
      });

      // Store challenge
      await xata.db.users.update(user.id, { challenge: options.challenge });

      return options;
    },
    { body: t.Object({ email: t.String({ format: 'email' }) }) }
  )
  // Authentication: Verify response
  .post(
    '/login/verify',
    async ({ body: { email, response } }) => {
      const user = await xata.db.users.filter({ email }).getFirst();
      if (!user || !user.challenge) {
        throw new Error('User or challenge not found');
      }

      // Ensure rawId is a Buffer
      const rawIdBuffer = Buffer.from(response.rawId, response.rawId instanceof ArrayBuffer ? 'base64' : undefined);
      const credential = await xata.db.credentials
        .filter({ credentialID: base64url.encode(rawIdBuffer) })
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
        await xata.db.credentials.update(credential.id, {
          counter: verification.authenticationInfo.newCounter,
        });

        await xata.db.users.update(user.id, { challenge: null });
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
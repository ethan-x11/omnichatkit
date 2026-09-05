import { Hono } from "hono";
import { handle } from "hono/vercel";
import { bearerAuth } from "hono/bearer-auth";
import { jwt } from "hono/jwt";
import type { MiddlewareHandler } from "hono";
import type { SignatureAlgorithm } from "hono/utils/jwt/jwa";

export interface OmniChatServerOptions {
  /**
   * The target backend URL to proxy requests to.
   * Defaults to process.env.BACKEND_URL.
   */
  backendUrl?: string;
  /**
   * The base path for the API route. Defaults to "/api".
   */
  basePath?: string;
  /**
   * Optional custom logic to extract user identity from the request.
   */
  identifyUser?: (req: Request) => { id?: string; name?: string } | Promise<{ id?: string; name?: string }>;
  /**
   * Security options to protect the API route.
   */
  security?: {
    /**
     * Require a specific API Key in the `x-api-key` header.
     */
    apiKey?: string | ((key: string) => boolean | Promise<boolean>);
    /**
     * Require a Bearer token in the `Authorization` header.
     * Uses `hono/bearer-auth`.
     */
    bearerToken?: string | ((token: string) => boolean | Promise<boolean>);
    /**
     * Require a valid JWT token (often used for OAuth).
     * Uses `hono/jwt`.
     */
    jwt?: {
      secret: string;
      alg: SignatureAlgorithm | "HS256";
    };
    /**
     * Custom Hono middleware for custom security logic (e.g. custom OAuth providers, session checks).
     */
    customMiddleware?: MiddlewareHandler | MiddlewareHandler[];
  };
}

/**
 * Creates a single entrypoint route handler for Next.js App Router (or other Vercel platforms)
 * that proxies requests to the OmniChat backend and handles authentication headers.
 */
export function serveOmniChat(options: OmniChatServerOptions = {}) {
  const basePath = options.basePath || "/api";
  const backendUrl = options.backendUrl || "";

  const app = new Hono().basePath(basePath);

  // Apply Security Middleware
  if (options.security) {
    const { security } = options;

    // 1. Custom Middleware
    if (security.customMiddleware) {
      const middlewares = Array.isArray(security.customMiddleware)
        ? security.customMiddleware
        : [security.customMiddleware];
      middlewares.forEach((m) => app.use("/*", m));
    }

    // 2. API Key Verification
    if (security.apiKey) {
      app.use("/*", async (c, next) => {
        const key = c.req.header("x-api-key");
        if (!key) return c.json({ error: "Unauthorized: Missing x-api-key header" }, 401);

        const isValid = typeof security.apiKey === "function"
          ? await security.apiKey(key)
          : security.apiKey === key;

        if (!isValid) return c.json({ error: "Unauthorized: Invalid API Key" }, 401);
        await next();
      });
    }

    // 3. Bearer Token Verification
    if (security.bearerToken) {
      if (typeof security.bearerToken === "function") {
        app.use("/*", bearerAuth({ verifyToken: security.bearerToken }));
      } else {
        app.use("/*", bearerAuth({ token: security.bearerToken }));
      }
    }

    // 4. JWT Validation
    if (security.jwt) {
      app.use("/*", jwt({
        secret: security.jwt.secret,
        alg: security.jwt.alg
      }));
    }
  }

  app.all("/*", async (c) => {
    // Proxy all requests to the backend URL
    const path = c.req.path.replace(basePath, "");

    // Ensure URL doesn't have double slashes if backendUrl ends with / and path starts with /
    let targetUrlString = backendUrl;
    if (targetUrlString.endsWith("/") && path.startsWith("/")) {
      targetUrlString += path.slice(1);
    } else if (!targetUrlString.endsWith("/") && !path.startsWith("/")) {
      targetUrlString += "/" + path;
    } else {
      targetUrlString += path;
    }

    const targetUrl = new URL(targetUrlString);
    const reqHeaders = new Headers(c.req.raw.headers);

    let id = reqHeaders.get("x-user-id");
    let encodedName = reqHeaders.get("x-user-name");

    // Allow overriding identity via custom function
    if (options.identifyUser) {
      const identity = await options.identifyUser(c.req.raw);
      if (identity.id) id = identity.id;
      if (identity.name) encodedName = encodeURIComponent(identity.name);
    }

    // Forward user identity headers
    reqHeaders.set("x-user-id", id || "demo-user");
    reqHeaders.set("x-user-name", encodedName ? decodeURIComponent(encodedName) : "Demo User");

    const req = new Request(targetUrl.toString(), {
      method: c.req.method,
      headers: reqHeaders,
      // body is a ReadableStream, which can be directly forwarded
      body: c.req.raw.body,
      redirect: "manual",
      // Needed for forwarding raw request body in Node.js
      // @ts-ignore
      duplex: "half"
    });

    return fetch(req);
  });

  const handler = handle(app);

  return {
    GET: handler,
    POST: handler,
    PATCH: handler,
    PUT: handler,
    DELETE: handler,
  };
}

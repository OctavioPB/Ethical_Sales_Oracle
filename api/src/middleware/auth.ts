import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN ?? "";
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE ?? "";
const ROLE_CLAIM = "https://eso.internal/role";

const JWKS = createRemoteJWKSet(
  new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`),
);

export interface TokenPayload {
  sub: string;
  email: string;
  role: "agent" | "supervisor" | "compliance";
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://${AUTH0_DOMAIN}/`,
    audience: AUTH0_AUDIENCE,
  });

  const role = (payload as Record<string, unknown>)[ROLE_CLAIM];
  if (role !== "agent" && role !== "supervisor" && role !== "compliance") {
    throw new Error("Missing or invalid role claim");
  }

  return {
    sub: String(payload.sub ?? ""),
    email: String((payload as Record<string, unknown>).email ?? ""),
    role: role as TokenPayload["role"],
  };
}

export function requireAuth(roles?: Array<"supervisor" | "compliance" | "agent">) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const payload = await verifyToken(token);
      (req as Request & { auth: TokenPayload }).auth = payload;

      if (roles && !roles.includes(payload.role)) {
        res.status(403).json({ error: "Insufficient role" });
        return;
      }

      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

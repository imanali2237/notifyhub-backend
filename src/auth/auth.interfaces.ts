import type { Request } from 'express';
import type { Tenant, User } from '../generated/prisma/client.js';

/** A user row loaded with `include: { tenant: true }`. */
export type UserWithTenant = User & { tenant: Tenant };

/** What we put inside the JWT when a user logs in. */
export interface JwtPayload {
  sub: string; // user id ("subject" — standard JWT claim name)
  tenantId: string;
  email: string;
}

/** The logged-in user, as controllers receive it via @CurrentUser(). */
export interface AuthUser {
  userId: string;
  tenantId: string;
  email: string;
}

/** An Express request after JwtAuthGuard has run. */
export type AuthenticatedRequest = Request & { user?: AuthUser };

/** Safe shape of a user + tenant for API responses (never includes passwordHash). */
export interface PublicAccount {
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
  };
  tenant: {
    id: string;
    name: string;
  };
}

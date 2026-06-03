import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { unauthorized } from "../lib/errors";
import { prisma } from "../lib/prisma";
import type { AuthUser } from "../types/auth";

const ACCESS_TOKEN_TTL = "7d";
const REFRESH_TOKEN_TTL = "30d";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  workMode: true,
  companyId: true,
  managerId: true,
  createdAt: true
};

export async function login(email: string, password: string) {
  // Emails are matched case-insensitively and trimmed so that a stray space or
  // a different capitalisation does not block an otherwise valid login.
  const normalizedEmail = email.trim();

  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user) {
    user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } }
    });
  }

  if (!user) {
    unauthorized("Account with this email does not exist.");
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    unauthorized("Incorrect password. Please try again.");
  }

  const authUser: AuthUser = {
    id: user.id,
    role: user.role,
    companyId: user.companyId,
    managerId: user.managerId,
    email: user.email,
    name: user.name
  };

  const publicUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: publicUserSelect
  });

  return {
    user: publicUser,
    accessToken: signAccessToken(authUser),
    refreshToken: signRefreshToken(authUser)
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const payload = jwt.verify(refreshToken, getRefreshSecret()) as JwtPayload & {
    tokenType?: string;
  };

  if (!payload.sub || payload.tokenType !== "refresh") {
    unauthorized("Invalid refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      role: true,
      companyId: true,
      managerId: true,
      email: true,
      name: true
    }
  });

  if (!user) {
    unauthorized("Invalid refresh token");
  }

  return {
    accessToken: signAccessToken(user)
  };
}

export function logout() {
  return {
    loggedOut: true
  };
}

function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    {
      role: user.role,
      companyId: user.companyId,
      managerId: user.managerId,
      tokenType: "access"
    },
    getJwtSecret(),
    {
      subject: user.id,
      expiresIn: ACCESS_TOKEN_TTL
    }
  );
}

function signRefreshToken(user: AuthUser): string {
  return jwt.sign(
    {
      tokenType: "refresh"
    },
    getRefreshSecret(),
    {
      subject: user.id,
      expiresIn: REFRESH_TOKEN_TTL
    }
  );
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET is not configured");
  }

  return secret;
}

import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { AppError, unauthorized } from "../lib/errors";
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

  // Also support login via phone number
  if (!user) {
    user = await prisma.user.findFirst({
      where: { phone: normalizedEmail }
    });
  }

  if (!user) {
    unauthorized("Account with this email or phone does not exist.");
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

export async function forgotPasswordSendOtp(identifier: string) {
  const normalizedIdentifier = identifier.trim();
  
  // Find user by email or phone
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: normalizedIdentifier, mode: "insensitive" } },
        { phone: { equals: normalizedIdentifier } }
      ]
    }
  });
  
  if (!user) {
    throw new AppError(400, "Account with this email or phone does not exist.");
  }
  
  let phone = user.phone.trim();
  if (!phone || phone === "0000000000" || phone === "0595") {
    throw new AppError(400, "No valid phone number configured for this account. Please contact admin.");
  }
  
  // Normalize phone number and determine country code
  let countryCode = "91"; // Default to India
  if (phone.startsWith("+")) {
    if (phone.startsWith("+91")) {
      countryCode = "91";
      phone = phone.replace("+91", "");
    } else {
      const match = phone.match(/^\+(\d{1,4})/);
      if (match) {
        countryCode = match[1];
        phone = phone.replace(`+${countryCode}`, "");
      }
    }
  } else if (phone.length > 10 && phone.startsWith("91")) {
    countryCode = "91";
    phone = phone.substring(2);
  }
  
  // Call Message Central API to send OTP
  const customerId = process.env.MESSAGECENTRAL_CUSTOMER_ID;
  const authToken = process.env.MESSAGECENTRAL_AUTH_TOKEN;
  const baseUrl = process.env.MESSAGECENTRAL_BASE_URL || "https://cpaas.messagecentral.com";
  
  if (!customerId || !authToken) {
    console.error("[Message Central] Missing customerId or authToken config!");
  }
  
  const url = `${baseUrl}/verification/v3/send?customerId=${customerId}&countryCode=${countryCode}&flowType=SMS&mobileNumber=${phone}&otpLength=4`;
  console.log(`[Message Central] Sending OTP to ${countryCode}${phone}... Url: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "authToken": authToken || "",
        "accept": "*/*"
      }
    });
    
    const responseData: any = await response.json();
    console.log("[Message Central] Response:", responseData);
    
    if (responseData && responseData.responseCode === 200 && responseData.data?.verificationId) {
      return {
        verificationId: responseData.data.verificationId,
        mobileNumber: responseData.data.mobileNumber || phone
      };
    } else {
      const errMsg = responseData?.message || responseData?.data?.errorMessage || "Failed to send OTP via SMS gateway";
      throw new AppError(400, errMsg);
    }
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    console.error("[Message Central] Error sending OTP:", err);
    throw new AppError(500, "Failed to send OTP: " + (err.message || "Unknown error"));
  }
}

export async function forgotPasswordReset(
  identifier: string,
  verificationId: string,
  code: string,
  newPassword: string
) {
  const normalizedIdentifier = identifier.trim();
  
  // Find user by email or phone
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: normalizedIdentifier, mode: "insensitive" } },
        { phone: { equals: normalizedIdentifier } }
      ]
    }
  });
  
  if (!user) {
    throw new AppError(400, "Account with this email or phone does not exist.");
  }
  
  let phone = user.phone.trim();
  if (!phone || phone === "0000000000" || phone === "0595") {
    throw new AppError(400, "No valid phone number configured for this account.");
  }
  
  // Normalize phone number and determine country code
  let countryCode = "91"; // Default to India
  if (phone.startsWith("+")) {
    if (phone.startsWith("+91")) {
      countryCode = "91";
      phone = phone.replace("+91", "");
    } else {
      const match = phone.match(/^\+(\d{1,4})/);
      if (match) {
        countryCode = match[1];
        phone = phone.replace(`+${countryCode}`, "");
      }
    }
  } else if (phone.length > 10 && phone.startsWith("91")) {
    countryCode = "91";
    phone = phone.substring(2);
  }
  
  // Call Message Central API to validate OTP
  const customerId = process.env.MESSAGECENTRAL_CUSTOMER_ID;
  const authToken = process.env.MESSAGECENTRAL_AUTH_TOKEN;
  const baseUrl = process.env.MESSAGECENTRAL_BASE_URL || "https://cpaas.messagecentral.com";
  
  const url = `${baseUrl}/verification/v3/validateOtp?verificationId=${verificationId}&code=${code}`;
  console.log(`[Message Central] Validating OTP for ${countryCode}${phone}. Url: ${url}`);

  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "authToken": authToken || "",
        "accept": "*/*"
      }
    });
    
    const responseData: any = await response.json();
    console.log("[Message Central] Validate OTP Response:", responseData);
    
    const isSuccess = responseData && (
      responseData.responseCode === 200 || 
      responseData.data?.verificationStatus === "VERIFICATION_COMPLETED"
    );
    
    if (!isSuccess) {
      const errMsg = responseData?.data?.errorMessage || responseData?.message || "Invalid or expired OTP code.";
      throw new AppError(400, errMsg);
    }
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    console.error("[Message Central] Error validating OTP:", err);
    throw new AppError(500, "Failed to validate OTP: " + (err.message || "Unknown error"));
  }
  
  // OTP is valid! Hash new password and update user record
  const passwordHash = await bcrypt.hash(newPassword, 10);
  
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });
  
  return { success: true, message: "Password reset successfully." };
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

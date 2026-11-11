import { getDashboardToken } from "../env";
import { NextRequest } from "next/server";

export function extractDashboardToken(req: NextRequest): string | null {
  const header = req.headers.get("X-Dashboard-Token")?.trim();
  if (header) return header;
  const auth = req.headers.get("Authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const cookie = req.cookies.get("dashboard_token")?.value?.trim();
  if (cookie) return cookie;
  return null;
}

export function requireDashboardToken(req: NextRequest): boolean {
  const token = extractDashboardToken(req);
  if (!token) return false;
  try {
    return token === getDashboardToken();
  } catch {
    return false;
  }
}

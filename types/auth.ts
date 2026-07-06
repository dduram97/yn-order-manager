export type UserRole = "admin" | "staff";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

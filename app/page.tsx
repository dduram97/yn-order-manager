import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

/** GET / — UI 진입점 (API route와 분리) */
export default async function RootPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  redirect(user.role === "admin" ? "/orders/new" : "/orders");
}

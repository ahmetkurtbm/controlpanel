export { auth as proxy } from "@/auth";

// The whole app is the control panel — everything is gated except the
// login page itself and the NextAuth API routes.
export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};

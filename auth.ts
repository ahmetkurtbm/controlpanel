import NextAuth from "next-auth";

// GateHub is our self-hosted OAuth2/OIDC provider (better-auth). This mirrors
// the working integration in the carrenting/receiptflow projects.
const issuer = process.env.GATEHUB_ISSUER ?? "http://localhost:3000/api/auth";

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isGateHubConfigured() {
  return Boolean(process.env.GATEHUB_CLIENT_ID && process.env.GATEHUB_CLIENT_SECRET);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? "controlpanel-development-secret-change-me",
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [
    {
      id: "gatehub",
      name: "GateHub",
      type: "oidc",
      issuer,
      clientId: process.env.GATEHUB_CLIENT_ID ?? "controlpanel-not-configured",
      clientSecret: process.env.GATEHUB_CLIENT_SECRET ?? "controlpanel-not-configured",
      authorization: {
        params: {
          scope: "openid profile email offline_access",
          prompt: "select_account",
        },
      },
      checks: ["pkce", "state"],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name ?? profile.email ?? "Control Panel kullanicisi",
          email: profile.email,
          image: profile.picture,
        };
      },
    },
  ],
  callbacks: {
    // Having a GateHub account is not enough — only allowlisted addresses may
    // reach the control panel. An empty allowlist denies everyone by design.
    signIn({ user }) {
      const allowed = adminEmails();
      const email = user.email?.toLowerCase();
      return Boolean(email && allowed.includes(email));
    },
    authorized({ auth: session }) {
      return Boolean(session?.user);
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

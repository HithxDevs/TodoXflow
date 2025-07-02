import NextAuth from "next-auth";
import type { SessionStrategy } from "next-auth";
import { authOptions } from "@/app/lib/authOptions";

// Extend the default session user type to include 'id'
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

const handler = NextAuth({
  ...authOptions,
  session: {
    strategy: "jwt" as SessionStrategy,
  },
});

export { handler as GET, handler as POST };
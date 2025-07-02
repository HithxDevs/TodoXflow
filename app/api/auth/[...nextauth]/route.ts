import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { PrismaClient } from "@/app/generated/prisma";

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

const prisma = new PrismaClient();

export const handler = NextAuth({
  providers: [
    // Credentials Provider for email/password login
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "example@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Find user in DB
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;

        const isPasswordCorrect = await compare(credentials.password, user.password);

        if (!isPasswordCorrect) return null;

        // Return only essential fields (for JWT/session)
        return {
          id: user.id,
          email: user.email,
          name: user.name
        };
      },
    }),
    
    // Google Provider for Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  
  pages: {
    signIn: "/auth/signin",
  },
  
  session: {
    strategy: "jwt",
  },
  
  callbacks: {
    // Handle sign-in logic for different providers
    async signIn({ user, account }) {
      try {
        // Handle Google sign-in
        if (account?.provider === "google") {
          // Check if user already exists
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          });

          if (!existingUser) {
            // Create new user from Google data
            await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || "Google User",
                // No password for Google users - they authenticate via Google
              },
            });
          } else {
            // Update existing user's Google info if needed
            await prisma.user.update({
              where: { email: user.email! },
              data: {
                name: user.name || existingUser.name
              },
            });
          }
        }
        
        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },

    // JWT callback - runs whenever JWT is accessed
    async jwt({ token, user }) {
      // Define a type for the user object
      type JWTUser = {
        id?: string;
        email?: string;
        name?: string;
      };

      // If this is the first time JWT is created (user just signed in)
      if (user) {
        token.user = {
          id: user.id,
          email: user.email,
          name: user.name
        } as JWTUser;
      }

      // For subsequent requests, get fresh user data from DB
      const jwtUser = token.user as JWTUser | undefined;
      if (jwtUser?.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: jwtUser.email },
            select: {
              id: true,
              email: true,
              name: true,
            },
          });

          if (dbUser) {
            token.user = dbUser;
          }
        } catch (error) {
          console.error("Error fetching user in JWT callback:", error);
        }
      }

      return token;
    },

    // Session callback - runs when session is accessed
    async session({ session, token }) {
      // Pass user data from JWT to session
      const user = token.user as { id?: string; email?: string; name?: string } | undefined;
      if (user) {
        session.user = {
          id: user.id ?? "",
          email: user.email ?? "",
          name: user.name ?? null,
        };
      }
      
      return session;
    },
  },
  
  events: {
    // Optional: Log sign-in events
    async signIn({ user, account }) {
      console.log(`User ${user.email} signed in with ${account?.provider}`);
    },
    
    async signOut() {
      console.log(`User signed out`);
    },
  },
  
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { PrismaClient } from "@/app/generated/prisma";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
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

        try {
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
        } catch (error) {
          console.error("Authorization error:", error);
          return null;
        }
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
          if (!user.email) return false;

          // Check if user already exists
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          });

          if (!existingUser) {
            // Create new user from Google data
            await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || "Google User",
                // No password for Google users - they authenticate via Google
              },
            });
          } else {
            // Update existing user's Google info if needed
            await prisma.user.update({
              where: { email: user.email },
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
      // If this is the first time JWT is created (user just signed in)
      if (user) {
        token.user = {
          id: user.id,
          email: user.email,
          name: user.name
        };
      }

      // For subsequent requests, get fresh user data from DB
      if (token.user && typeof token.user === 'object' && 'email' in token.user) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.user.email as string },
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
      if (token.user && typeof token.user === 'object') {
        const user = token.user as { id?: string; email?: string; name?: string };
        session.user = {
          id: user.id || "",
          email: user.email || "",
          name: user.name || null,
        };
      }
      
      return session;
    },
  },
  
  secret: process.env.NEXTAUTH_SECRET,
};
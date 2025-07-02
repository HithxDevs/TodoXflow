const { FlatCompat } = require("@eslint/eslintrc");
const path = require("path");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

module.exports = [
  // Global ignores - this replaces .eslintignore
  {
    ignores: [
      // Generated files (most important for your Prisma issue)
      "app/generated/**/*",
      "prisma/generated/**/*", 
      "**/*.generated.*",
      
      // Build outputs
      ".next/**/*",
      "out/**/*",
      "build/**/*",
      "dist/**/*",
      
      // Dependencies
      "node_modules/**/*",
      
      // Environment and config
      ".env*",
      ".vercel/**/*",
      
      // Logs
      "*.log*",
    ]
  },
  
  // Extend Next.js ESLint config
  ...compat.extends("next/core-web-vitals"),
  
  // Custom rules
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // future/ holds parked features; their tests still run so they keep working.
    include: ["tests/**/*.test.ts", "future/**/tests/*.test.ts"],
    testTimeout: 20000,
    // Test files share one Firestore emulator, so run them one at a time.
    fileParallelism: false,
  },
});

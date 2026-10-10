import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from 'node:url';
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://127.0.0.1:3001" },
    fs: {
      strict:true,
      allow:[fileURLToPath(new URL('.',import.meta.url)),fileURLToPath(new URL('../node_modules',import.meta.url))],
      deny:['.env','.env.*','**/.local/**','**/.git/**','**/uploads/**','**/*.{crt,pem}','**/tools_management_system.html','**/note.html']
    }
  },
});

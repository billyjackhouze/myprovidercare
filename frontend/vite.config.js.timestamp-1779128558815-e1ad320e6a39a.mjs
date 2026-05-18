import "node:module";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import.meta.url;
var vite_config_default = defineConfig({
	plugins: [react()],
	resolve: { alias: { "@": path.resolve("/sessions/zealous-admiring-euler/mnt/National/NationalCM/frontend", "./src") } },
	server: {
		port: 5173,
		proxy: { "/api": {
			target: "http://localhost:8080",
			changeOrigin: true
		} }
	},
	build: {
		outDir: "../backend/dist",
		emptyOutDir: true
	}
});
//#endregion
export { vite_config_default as default };

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS5jb25maWcuanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsiL3Nlc3Npb25zL3plYWxvdXMtYWRtaXJpbmctZXVsZXIvbW50L05hdGlvbmFsL05hdGlvbmFsQ00vZnJvbnRlbmQvdml0ZS5jb25maWcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgIH0sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjgwODAnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAnLi4vYmFja2VuZC9kaXN0JyxcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgfSxcbn0pXG4iXSwibWFwcGluZ3MiOiI7Ozs7O0FBSUEsSUFBQSxzQkFBZSxhQUFhO0NBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7Q0FDakIsU0FBUyxFQUNQLE9BQU8sRUFDTCxLQUFLLEtBQUssUUFBQSxxRUFBbUIsT0FBTyxFQUN0QyxFQUNGO0NBQ0EsUUFBUTtFQUNOLE1BQU07RUFDTixPQUFPLEVBQ0wsUUFBUTtHQUNOLFFBQVE7R0FDUixjQUFjO0VBQ2hCLEVBQ0Y7Q0FDRjtDQUNBLE9BQU87RUFDTCxRQUFRO0VBQ1IsYUFBYTtDQUNmO0FBQ0YsQ0FBQyJ9
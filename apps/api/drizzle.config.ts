import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	driver: 'd1',
	verbose: true,
	strict: true,
})

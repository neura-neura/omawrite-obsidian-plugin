import esbuild from "esbuild";

const production = process.argv.includes("production");

const buildOptions = {
	entryPoints: ["main.ts"],
	bundle: true,
	format: "cjs",
	target: "es2018",
	platform: "browser",
	sourcemap: production ? false : "inline",
	minify: production,
	outfile: "main.js",
	external: ["obsidian", "electron", "@electron/remote", "@codemirror/*"],
	logLevel: "info",
};

const context = await esbuild.context(buildOptions);

if (production) {
	await context.rebuild();
	await context.dispose();
	console.log("Omawrite Mode built successfully.");
} else {
	await context.watch();
	console.log("Watching for changes...");
}

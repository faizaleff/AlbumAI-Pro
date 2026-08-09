const fs = require("fs");
const os = require("os");
const path = require("path");
const webpack = require("webpack");

const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), "albumai-alb045-fs-"));
webpack({ mode: "development", target: "node", entry: path.join(__dirname, "alb045-output-transaction-filesystem.test.js"), output: { path: outputPath, filename: "test-bundle.js" }, devtool: false, resolve: { extensions: [".js", ".jsx"] }, module: { rules: [{ test: /\.jsx?$/, exclude: /node_modules/, loader: "babel-loader", options: { plugins: ["@babel/plugin-transform-object-rest-spread"] } }] } }, (error, stats) => {
    if (error || stats?.hasErrors()) { console.error(error || stats.toString({ colors: false, errors: true, warnings: false })); process.exitCode = 1; return; }
    try { require(path.join(outputPath, "test-bundle.js")); } finally { process.on("exit", () => fs.rmSync(outputPath, { recursive: true, force: true })); }
});

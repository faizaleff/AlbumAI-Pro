const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(projectRoot, "src");
const policyPath = path.join(
    projectRoot,
    "Architecture",
    "ALB-050_ARCHITECTURE_POLICY.json"
);
const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function portable(filePath) {
    return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function sourceFiles(directory = sourceRoot) {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const filePath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...sourceFiles(filePath));
        else if (/\.(?:js|jsx|css)$/.test(entry.name)) files.push(portable(filePath));
    }
    return files.sort();
}

function visit(node, callback) {
    if (!node || typeof node !== "object") return;
    callback(node);
    for (const [key, value] of Object.entries(node)) {
        if (key === "loc" || key === "start" || key === "end") continue;
        if (Array.isArray(value)) value.forEach(item => visit(item, callback));
        else if (value && typeof value === "object" && value.type) visit(value, callback);
    }
}

function importSpecifiers(file) {
    if (file.endsWith(".css")) return [];
    const source = fs.readFileSync(path.join(projectRoot, file), "utf8");
    const ast = babel.parseSync(source, {
        filename: file,
        sourceType: "unambiguous",
        parserOpts: { plugins: ["jsx"] }
    });
    const specifiers = [];
    visit(ast, node => {
        if ((node.type === "ImportDeclaration" ||
            node.type === "ExportNamedDeclaration" ||
            node.type === "ExportAllDeclaration") && node.source?.value) {
            specifiers.push(node.source.value);
        }
        if (node.type === "CallExpression" &&
            node.callee?.type === "Identifier" &&
            node.callee.name === "require" &&
            node.arguments?.[0]?.type === "StringLiteral") {
            specifiers.push(node.arguments[0].value);
        }
    });
    return [...new Set(specifiers)];
}

function resolveLocalImport(importer, specifier) {
    if (!specifier.startsWith(".")) return null;
    const base = path.resolve(projectRoot, path.dirname(importer), specifier);
    const candidates = [
        base,
        `${base}.js`,
        `${base}.jsx`,
        `${base}.css`,
        path.join(base, "index.js"),
        path.join(base, "index.jsx")
    ];
    const resolved = candidates.find(candidate =>
        fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    );
    check(Boolean(resolved), `Unresolved local import ${specifier} from ${importer}.`);
    return portable(resolved);
}

function reachableFiles(entry) {
    const reachable = new Set();
    const pending = [entry];
    while (pending.length) {
        const file = pending.pop();
        if (reachable.has(file)) continue;
        reachable.add(file);
        for (const specifier of importSpecifiers(file)) {
            const dependency = resolveLocalImport(file, specifier);
            if (dependency && !reachable.has(dependency)) pending.push(dependency);
        }
    }
    return [...reachable].sort();
}

function sameFiles(left, right) {
    return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function main() {
    check(policy.schemaVersion === 1, "Unsupported architecture policy schema.");
    check(policy.entry === "src/index.jsx", "The canonical source entry must remain src/index.jsx.");
    check(policy.baseline.sourceFiles === 436, "ALB-050 baseline source count changed.");
    check(policy.baseline.activeFiles === 95, "ALB-050 active baseline count changed.");
    check(policy.baseline.inactiveFiles === 341, "ALB-050 inactive baseline count changed.");
    check(policy.activeFiles.length === 121, "Architecture policy must list all 121 active files.");
    check(policy.inactiveDisposition.delete.length === 341,
        "Architecture policy must classify all 341 inactive files.");
    check(policy.inactiveDisposition.migrate.length === 0,
        "No ALB-050 migration candidate is expected.");
    check(policy.inactiveDisposition.retainTemporarily.length === 0,
        "No unreachable source is retained temporarily.");

    const currentFiles = sourceFiles();
    check(sameFiles(currentFiles, policy.activeFiles),
        "src contains a file outside the canonical active architecture or is missing an active file.");
    const reachable = reachableFiles(policy.entry);
    check(sameFiles(reachable, policy.activeFiles),
        "The canonical entry graph no longer reaches exactly the 120 active files.");
    check(policy.inactiveDisposition.delete.every(file => !fs.existsSync(path.join(projectRoot, file))),
        "A retired inactive source file has reappeared.");

    const owners = Object.values(policy.domainOwners);
    check(new Set(owners).size === owners.length, "Each active domain must have one distinct owner.");
    check(owners.every(file => reachable.includes(file)), "Every active domain owner must be reachable.");
    check(policy.photoshopAdapters.every(file => reachable.includes(file)),
        "Every allowed Photoshop adapter must remain in the active graph.");

    const webpackConfig = require(path.join(projectRoot, "webpack.config.js"));
    check(webpackConfig({}, { mode: "production" }).entry === "./src/index.jsx",
        "webpack must use only src/index.jsx as its source entry.");
    const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "plugin", "manifest.json"), "utf8"));
    check(manifest.main === "index.html", "The UXP manifest must use index.html as its only startup document.");
    const html = fs.readFileSync(path.join(projectRoot, "plugin", "index.html"), "utf8");
    check((html.match(/<script\s+src=["']index\.js["']/g) || []).length === 1,
        "The UXP startup document must load one index.js bundle.");

    console.log(`ALB-050 architecture verification: PASS (${assertions} assertions, ${reachable.length} reachable source files)`);
}

main();

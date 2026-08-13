#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const root = path.resolve(__dirname, "..");
const regression = JSON.parse(fs.readFileSync(path.join(root, "Architecture", "ALB-051_REGRESSION_POLICY.json"), "utf8"));
const architecture = JSON.parse(fs.readFileSync(path.join(root, regression.sourcePolicy), "utf8"));
let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function portable(file) {
    return path.relative(root, file).split(path.sep).join("/");
}

function visit(node, callback) {
    if (!node || typeof node !== "object") return;
    callback(node);
    for (const [key, value] of Object.entries(node)) {
        if (["loc", "start", "end"].includes(key)) continue;
        if (Array.isArray(value)) value.forEach(item => visit(item, callback));
        else if (value && typeof value === "object" && value.type) visit(value, callback);
    }
}

function imports(file) {
    if (file.endsWith(".css")) return [];
    const source = fs.readFileSync(path.join(root, file), "utf8");
    const ast = babel.parseSync(source, {
        filename: file,
        sourceType: "unambiguous",
        parserOpts: { plugins: ["jsx"] }
    });
    const values = [];
    visit(ast, node => {
        if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type) && node.source?.value) {
            values.push(node.source.value);
        }
        if (node.type === "CallExpression" && node.callee?.name === "require" && node.arguments?.[0]?.type === "StringLiteral") {
            values.push(node.arguments[0].value);
        }
    });
    return [...new Set(values)];
}

function resolve(importer, specifier) {
    if (!specifier.startsWith(".")) return null;
    const base = path.resolve(root, path.dirname(importer), specifier);
    const candidates = [base, `${base}.js`, `${base}.jsx`, `${base}.css`, path.join(base, "index.js"), path.join(base, "index.jsx")];
    const found = candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    check(Boolean(found), `Unresolved local import ${specifier} from ${importer}.`);
    return portable(found);
}

function graph(entries) {
    const reached = new Set();
    const pending = entries.slice();
    while (pending.length) {
        const file = pending.pop();
        if (reached.has(file)) continue;
        reached.add(file);
        for (const specifier of imports(file)) {
            const dependency = resolve(file, specifier);
            if (dependency && !reached.has(dependency)) pending.push(dependency);
        }
    }
    return reached;
}

function listTests() {
    return fs.readdirSync(path.join(root, "tests"))
        .filter(name => name.endsWith(".test.js"))
        .map(name => `tests/${name}`)
        .sort();
}

function main() {
    check(regression.schemaVersion === 1, "Unsupported ALB-051 regression policy schema.");
    check(regression.ticket === "ALB-051", "Regression policy ticket mismatch.");
    check(architecture.activeFiles.length === regression.baseline.activeFiles, "Active source baseline mismatch.");

    const tests = listTests();
    const legacy = tests.filter(file => file !== regression.regressionEntry);
    const active = new Set(architecture.activeFiles);
    const legacySource = [...graph(legacy)].filter(file => active.has(file)).sort();
    const currentSource = [...graph(tests)].filter(file => active.has(file)).sort();
    const legacyGap = architecture.activeFiles.filter(file => !legacySource.includes(file));

    check(legacySource.length === regression.baseline.legacyTestReachableFiles,
        `Legacy test graph changed: expected ${regression.baseline.legacyTestReachableFiles}, received ${legacySource.length}.`);
    check(legacyGap.length === regression.baseline.legacyTestGapFiles,
        `Legacy test gap changed: expected ${regression.baseline.legacyTestGapFiles}, received ${legacyGap.length}.`);
    check(currentSource.length === regression.baseline.postAlb051ReachableFiles,
        `ALB-051 test graph reaches ${currentSource.length} active files, expected ${regression.baseline.postAlb051ReachableFiles}.`);
    check(architecture.activeFiles.every(file => currentSource.includes(file)),
        "At least one canonical active source file is outside the regression graph.");

    const regressionGraph = graph([regression.regressionEntry]);
    for (const file of regression.requiredUiModules) {
        check(regressionGraph.has(file), `Required active UI module is not covered: ${file}.`);
    }

    const ids = new Set();
    for (const criterion of regression.v101Acceptance) {
        check(Boolean(criterion.id) && !ids.has(criterion.id), "Acceptance criterion ids must be unique.");
        ids.add(criterion.id);
        check(Boolean(criterion.criterion), `${criterion.id} has no criterion text.`);
        check(Array.isArray(criterion.automated) && criterion.automated.length > 0,
            `${criterion.id} has no automated mapping.`);
        check(Array.isArray(criterion.runtimeScenarios), `${criterion.id} has invalid runtime mappings.`);
    }
    const runtimeIds = new Set(regression.runtimeScenarios.map(item => item.id));
    check(runtimeIds.size === regression.runtimeScenarios.length, "Runtime scenario ids must be unique.");
    regression.runtimeScenarios.forEach(item => {
        check(Boolean(item.procedure) && Boolean(item.pass) && Boolean(item.fixtureRule),
            `${item.id} must define safe procedure, fixture rule, and pass criteria.`);
    });
    regression.v101Acceptance.flatMap(item => item.runtimeScenarios).forEach(id => {
        check(runtimeIds.has(id), `Acceptance matrix references missing runtime scenario ${id}.`);
    });

    console.info(`ALB-051 regression verification: PASS (${assertions} assertions, ${currentSource.length}/${architecture.activeFiles.length} active files reached)`);
    console.info(`ALB-051 legacy gap closed: ${legacyGap.join(", ")}`);
}

main();

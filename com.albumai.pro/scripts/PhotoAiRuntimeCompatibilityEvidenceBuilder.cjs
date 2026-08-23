const fs = require("fs");
const path = require("path");
const {
    PhotoAiRuntimeHostEvidenceError,
    RuntimeHostEvidenceError,
    buildPhotoAiRuntimeCompatibilityEvidence
} = require("./PhotoAiRuntimeHostEvidenceCore.js");

async function writeNewJson(outputPath, value) {
    const absoluteOutput = path.resolve(outputPath);
    try {
        await fs.promises.writeFile(
            absoluteOutput,
            `${JSON.stringify(value, null, 2)}\n`,
            { encoding: "utf8", flag: "wx", mode: 0o600 }
        );
    } catch (_error) {
        throw new RuntimeHostEvidenceError(
            PhotoAiRuntimeHostEvidenceError.OUTPUT_WRITE_FAILED
        );
    }
}

async function runCli(argv = process.argv.slice(2)) {
    if (argv.length !== 3) {
        throw new RuntimeHostEvidenceError(
            PhotoAiRuntimeHostEvidenceError.HOST_RECORDS_INCOMPLETE
        );
    }
    let records;
    try {
        records = await Promise.all(argv.slice(1).map(async filePath =>
            JSON.parse(await fs.promises.readFile(filePath, "utf8"))
        ));
    } catch (_error) {
        throw new RuntimeHostEvidenceError(
            PhotoAiRuntimeHostEvidenceError.HOST_RECORD_INVALID
        );
    }
    const evidence = buildPhotoAiRuntimeCompatibilityEvidence(records);
    await writeNewJson(argv[0], evidence);
    process.stdout.write("Photo AI runtime compatibility evidence: VERIFIED\n");
}

module.exports = { runCli, writeNewJson };

if (require.main === module) {
    runCli().catch(error => {
        const code = error instanceof RuntimeHostEvidenceError
            ? error.code
            : PhotoAiRuntimeHostEvidenceError.HOST_RECORD_INVALID;
        process.stderr.write(`Photo AI runtime compatibility evidence: ${code}\n`);
        process.exitCode = 1;
    });
}

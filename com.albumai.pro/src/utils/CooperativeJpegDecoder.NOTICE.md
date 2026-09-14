# Cooperative JPEG decoder

Derived from jpeg-js 0.4.4, lib/decoder.js (Copyright 2011 notmasteryet),
Apache License 2.0. The upstream notice is retained in the source and extracted
into the runtime's license notices. The repository LICENSE contains Apache 2.0.

AlbumAI changes: generator checkpoints in coefficient allocation, baseline and
progressive scans, IDCT component construction, color conversion and RGB copying;
an asynchronous serialized runner with cancellation; requested-size RGB output;
removal of the unused network loader and browser-global export.

Foreground zoom reuses one parsed image's component planes, up to 96 MiB,
for at most 30 seconds of idle time. DCT coefficient arrays are discarded.
Cache reuse retains allocation/resolution checks, re-applies output options,
and never retains a cancelled request callback. Workspace cleanup clears it.

This is not a native reduced-IDCT decoder: source entropy coefficients and
component planes still occupy memory proportional to source dimensions. It avoids
full-resolution RGB output for reduced previews and yields to the UI between
chunks. Upstream malformed-input and memory/resolution checks remain enabled.

Validation: tests/cooperative-jpeg-decoder.test.js compares native-size pixels
with upstream jpeg-js for baseline RGB and progressive RGB, grayscale and CMYK.
The JSON fixtures are synthetic gradients generated with Pillow, not user photos.

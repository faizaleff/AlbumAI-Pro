const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const { minifyCss } = require("./scripts/minify-css-loader");

module.exports = (_env, argv = {}) => {
    const isProduction = argv.mode === "production";

    return {
    entry: './src/index.jsx',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.js',
        clean: isProduction,
        //libraryTarget: "commonjs2"
    },
    devtool: isProduction ? false : 'eval-cheap-source-map',
    externals: {
        uxp: 'commonjs2 uxp',
        photoshop: 'commonjs2 photoshop',
        os: 'commonjs2 os'
    },
    resolve: {
        extensions: [".js", ".jsx"],
        alias: {
            buffer: path.resolve(__dirname, "src/utils/JpegBuffer.js")
        }
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                loader: "babel-loader",
                options: {
                    plugins: [
                        path.resolve(__dirname, "scripts/share-object-spread-helper.js"),
                        "@babel/transform-react-jsx",
                        "@babel/plugin-transform-object-rest-spread",
                    ]
                }
            },
            {
                test: /\.png$/,
                exclude: /node_modules/,
                type: "asset/resource"
            },
            {
                test: /\.css$/,
                type: "asset/source",
                sideEffects: false
            }
        ]
    },
    plugins: [
        new webpack.BannerPlugin({
            banner: fs.readFileSync(require.resolve("@babel/helpers/LICENSE"), "utf8"),
            entryOnly: true
        }),
        new webpack.ProvidePlugin({
            Buffer: ["buffer", "Buffer"]
        }),
        new CopyPlugin({
            patterns: [{
                from: "plugin",
                to: ".",
                globOptions: {
                    ignore: [
                        "**/.DS_Store",
                        "**/index.js",
                        "**/index.html"
                    ]
                }
            }, {
                from: "plugin/index.html",
                to: "index.html",
                transform(content) {
                    const css = minifyCss(fs.readFileSync(
                        path.resolve(__dirname, "src/styles.css"),
                        "utf8"
                    ));
                    return content.toString().replace(
                        "/* ALBUMAI_STYLES */",
                        css
                    );
                }
            }]
        })
    ],
    performance: {
        hints: "error",
        // ALB-071, ALB-072, ALB-081, ALB-082, ALB-090, and ALB-100 incorporate local AI signals, culling modal,
        // live spread canvas, sheet storyboard strip, smart auto-flow, print proofing, and wedding wizard intelligence.
        // ALB-103 adds in-product runtime identity diagnostics; ALB-118 adds the canonical
        // typography inventory and plan boundary; ALB-120 adds the guarded real-host
        // qualification harness; ALB-121 adds the manual typography workflow and
        // ALB-122 adds template-local style choices; ALB-123 adds guarded text
        // placement; ALB-124 adds independent template-local font and style
        // presets; ALB-125 adds offline suggestions and ALB-126 adds the
        // project-local custom preset catalog and management UI. Keep a tight
        // Direct rendered-preview slot geometry and guarded drag gestures add a 5 KiB allowance.
        // Manual in-slot position/zoom adds a further 2 KiB allowance.
        // Includes the asset-to-slot gesture handler (about 1 KiB).
        // 790 KiB ceiling includes compact descriptions, collage labels, stable rendered previews,
        // direct draft editing and the optional online
        // provider/consent UI; retain an explicit bound rather than silently accepting
        // unbounded runtime growth.
        // Includes brush-alpha capture and bounded draft shape covers.
        // Cross-spread drag coordination and confirmation UI: 5 KiB allowance.
        maxAssetSize: 800 * 1024,
        maxEntrypointSize: 800 * 1024
    }
    };
};

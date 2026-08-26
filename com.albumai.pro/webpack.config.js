const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");

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
                use: ["style-loader", "css-loader"]
            }
        ]
    },
    plugins: [
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
                        "**/index.js"
                    ]
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
        // placement. Keep a tight 729 KiB ceiling rather than silently accepting
        // unbounded runtime growth.
        maxAssetSize: 729 * 1024,
        maxEntrypointSize: 729 * 1024
    }
    };
};

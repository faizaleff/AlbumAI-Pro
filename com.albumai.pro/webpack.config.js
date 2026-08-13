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
        extensions: [".js", ".jsx"]
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
                    ignore: ["**/.DS_Store"]
                }
            }]
        })
    ],
    performance: {
        hints: "error",
        // ALB-070 Slice 2 admits only the measured synthetic feasibility
        // diagnostic: 68 WASM bytes plus its bounded loader/report code. The
        // 562 KiB ceiling is 2 KiB above Slice 1 and still excludes production
        // model/runtime assets pending the Slice 3 ADR and licensing gate.
        maxAssetSize: 562 * 1024,
        maxEntrypointSize: 562 * 1024
    }
    };
};

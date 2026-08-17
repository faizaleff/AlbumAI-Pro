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
                    ignore: ["**/.DS_Store"]
                }
            }]
        })
    ],
    performance: {
        hints: "error",
        // ALB-071 incorporates local heuristic photo quality signals (sharpness, exposure, contrast)
        // and burst/event grouping engines into the production bundle.
        maxAssetSize: 575 * 1024,
        maxEntrypointSize: 575 * 1024
    }
    };
};

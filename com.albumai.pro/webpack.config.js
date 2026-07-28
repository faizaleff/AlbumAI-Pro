const path = require("path");
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
                        "@babel/proposal-object-rest-spread",
                        "@babel/plugin-syntax-class-properties",
                    ]
                }
            },
            {
                test: /\.png$/,
                exclude: /node_modules/,
                loader: 'file-loader'
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            }
        ]
    },
    plugins: [
        new CopyPlugin([{
            from: 'plugin',
            to: '.',
            ignore: ['.DS_Store', '**/.DS_Store']
        }], {
            copyUnmodified: true
        })
    ]
    };
};

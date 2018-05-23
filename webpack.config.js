const path = require('path');

module.exports = {
    mode: "development",
    devtool: "inline-source-map",
    devServer: {
      contentBase: path.join(__dirname, "dist")
    },
    entry: './src/nanowasp.ts',
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'dist')
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js"]
    },
    module: {
      rules: [
          { test: /\.tsx?$/, loader: "ts-loader" }
      ]
    }
};

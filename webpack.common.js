const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const childProcess = require('child_process');

let gitDescription = childProcess.execSync('git describe').toString().trim();
let hasChanges = true;
try {
  childProcess.execSync('git diff --quiet HEAD');
  hasChanges = false;
}
catch (ex) {
}

let version = gitDescription + (hasChanges ? '-mods' : '');

let now = new Date();
updateDate = now.toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });

module.exports = {
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
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/nanowasp.html',
        templateParameters: {
          version,
          updateDate
        }
      })
    ]
};

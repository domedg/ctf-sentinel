const fs = require('fs');
const path = require('path');
const appPath = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(appPath, 'utf8');
content = content.replace(/teal-/g, 'green-');
content = content.replace(/prose-teal/g, 'prose-green');
fs.writeFileSync(appPath, content);
console.log('Teal replaced with green successfully.');

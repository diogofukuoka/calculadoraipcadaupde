import fs from 'fs';

let content = fs.readFileSync('index.html', 'utf8');

content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');
content = content.replace(/\\\\n/g, '\\n');
content = content.replace(/\\\\s\+/g, '\\s+');
content = content.replace(/\\\\\./g, '\\.');

fs.writeFileSync('index.html', content);
console.log('Fixed index.html');

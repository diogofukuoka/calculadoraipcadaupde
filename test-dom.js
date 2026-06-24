import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable"
});

dom.window.onerror = function(message, source, lineno, colno, error) {
  console.log('Error caught:', message, error);
};

dom.window.document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded!');
  setTimeout(() => {
    console.log('Done waiting. Script execution finished.');
  }, 2000);
});

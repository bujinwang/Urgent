const fs = require('fs');
const path = '/Users/bujin/Documents/Projects/Urgent/急救侠_H5_Demo_v17.html';
const content = fs.readFileSync(path, 'utf8');
const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) {
  console.log("No style tag found");
  process.exit(1);
}
const css = styleMatch[1];

// We can use css package to parse

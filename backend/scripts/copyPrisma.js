const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'prisma');
const dest = path.join(__dirname, '..', 'dist', 'prisma');

try {
    fs.cpSync(src, dest, { recursive: true });
    console.log('Copied prisma folder to dist/prisma');
} catch (err) {
    console.error('Failed to copy prisma folder', err);
    process.exit(1);
}
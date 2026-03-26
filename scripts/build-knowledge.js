import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const utilsDir = path.join(__dirname, '..', 'Utils');
const outputDir = path.join(__dirname, '..', 'public');
const outputFile = path.join(outputDir, 'knowledge.txt');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Supported file extensions for knowledge extraction
const allowedExtensions = ['.txt', '.md', '.py', '.c', '.json', '.xml'];

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

console.log('[+] Building CTF Sentinel Knowledge Base...');
let knowledgeBase = 'CTF SENTINEL - INTERNAL KNOWLEDGE BASE AND METHODOLOGIES\n';
knowledgeBase += '=========================================================\n\n';

let addedFilesCount = 0;
const MAX_CHARS = 100000; // Hard cap at ~100k characters (~25k tokens) to completely dodge free-tier errors

walkDir(utilsDir, (filePath) => {
  if (knowledgeBase.length >= MAX_CHARS) return; // Stop adding if we reach the hard cap

  const ext = path.extname(filePath).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    try {
      const relativePath = path.relative(utilsDir, filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Basic check to avoid reading huge binary blobs
      if (content.length > 0 && !content.includes('\0')) {
        knowledgeBase += `\n\n--- BEGIN FILE: ${relativePath} ---\n`;
        knowledgeBase += content;
        knowledgeBase += `\n--- END FILE: ${relativePath} ---\n`;
        addedFilesCount++;
      }
    } catch (e) {
      console.warn(`[!] Failed to read file: ${filePath}`, e.message);
    }
  }
});

// Trim if we slightly exceeded the max cap during the last file addition
if (knowledgeBase.length > MAX_CHARS) {
  knowledgeBase = knowledgeBase.substring(0, MAX_CHARS) + '\n\n... [TRUNCATED TO PREVENT API QUOTA EXCEEDED] ...';
}

fs.writeFileSync(outputFile, knowledgeBase);
console.log(`[+] Knowledge base built successfully! (${addedFilesCount} files included)`);

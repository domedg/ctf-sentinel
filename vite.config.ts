import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';

function reconPlugin() {
  return {
    name: 'recon-plugin',
    configureServer(server) {
      server.middlewares.use('/api/recon', (req, res, next) => {
        if (req.method === 'POST') {
          const tmpDir = os.tmpdir();
          const fileName = req.headers['x-file-name'] || `binary_${Date.now()}`;
          const safeName = path.basename(fileName as string).replace(/[^a-zA-Z0-9_.-]/g, '_');
          const filePath = path.join(tmpDir, safeName);
          
          const writeStream = fs.createWriteStream(filePath);
          req.pipe(writeStream);
          
          req.on('end', () => {
             const workspacePath = process.cwd();
             const reconScript = path.join(workspacePath, 'Utils', 'recon.py');

             exec(`python3 "${reconScript}" "${filePath}" --noinput`, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
               fs.unlink(filePath, () => {}); // Cleanup
               res.setHeader('Content-Type', 'text/plain');
               res.end(stdout || stderr || "No output generated");
             });
          });
          
          req.on('error', () => {
             res.statusCode = 500;
             res.end('Error reading request');
          });
        } else {
          next();
        }
      });

      server.middlewares.use('/api/tools', (req, res, next) => {
        if (req.method === 'GET') {
           try {
               let tools: {name: string, url: string}[] = [];
               const extractLinks = (text: string) => {
                   const matches = Array.from(text.matchAll(/\*\s+\**\[(.*?)\]\((.*?)\)\**/g));
                   matches.forEach(m => {
                       if (!tools.find(t => t.url === m[2]) && m[2].startsWith('http')) {
                           tools.push({ name: m[1], url: m[2] });
                       }
                   });
               };

               const toolsPath = path.join(process.cwd(), 'Utils', 'Tools.md');
               if (fs.existsSync(toolsPath)) {
                   extractLinks(fs.readFileSync(toolsPath, 'utf8'));
               }
               
               const repomixPath = path.join(process.cwd(), 'Utils', 'RepoMix', 'repomix-output-iamleblanc-CTF-tools.xml');
               if (fs.existsSync(repomixPath)) {
                   extractLinks(fs.readFileSync(repomixPath, 'utf8'));
               }
               
               res.setHeader('Content-Type', 'application/json');
               res.end(JSON.stringify(tools));
           } catch(e) {
               res.setHeader('Content-Type', 'application/json');
               res.end('[]');
           }
        } else {
           next();
        }
      });

      server.middlewares.use('/api/writeup', (req, res, next) => {
        if (req.method === 'POST') {
           let body = '';
           req.on('data', chunk => body += chunk.toString());
           req.on('end', () => {
              try {
                 const data = JSON.parse(body);
                 const writeupsDir = path.join(process.cwd(), 'Writeups');
                 if (!fs.existsSync(writeupsDir)) {
                     fs.mkdirSync(writeupsDir);
                 }
                 const safeTitle = (data.title || 'Untitled_Challenge').replace(/[^a-zA-Z0-9_.-]/g, '_');
                 const filepath = path.join(writeupsDir, `Writeup_${safeTitle}_${Date.now()}.md`);
                 fs.writeFileSync(filepath, data.content);
                 
                 res.setHeader('Content-Type', 'application/json');
                 res.end(JSON.stringify({ success: true, path: filepath }));
              } catch(e: any) {
                 res.statusCode = 500;
                 res.end(JSON.stringify({ error: e.message || String(e) }));
              }
           });
           
           req.on('error', () => {
             res.statusCode = 500;
             res.end('Error reading request');
           });
        } else {
           next();
        }
      });
    }
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), reconPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

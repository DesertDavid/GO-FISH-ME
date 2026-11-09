import { readFileSync, mkdirSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';

// builds ship the licences of bundled npm packages (licenses.md) and of adapted code (THIRD_PARTY_NOTICES.md)
export default defineConfig({
  build: { license: { fileName: 'licenses.md' } },
  plugins: [{
    // Disk copies of the saves in %LOCALAPPDATA%\ReelWorld\saves (survives a browser-profile reset).
    // Dev server only, localhost only, fixed file names, size capped.
    name: 'reelworld-save-backup',
    configureServer(server) {
      const port = server.config.server.port || 5200;   // test servers on other ports get their own folder
      const dir = process.env.REELWORLD_SAVES_DIR || join(process.env.LOCALAPPDATA || process.env.HOME || '.', 'ReelWorld', port === 5200 ? 'saves' : `saves-${port}`);
      server.middlewares.use('/__reelworld/backup', (req, res) => {
        const name = (req.url || '').replace(/^\//, '').split('?')[0];
        const host = String(req.headers.host || '').split(':')[0];
        const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(body); };
        if (!['localhost', '127.0.0.1', '[::1]'].includes(host) || !/^(autosave|slot-[1-9])$/.test(name)) return send(404, '{}');
        const file = join(dir, `${name}.json`);
        if (req.method === 'GET') return existsSync(file) ? send(200, readFileSync(file, 'utf8')) : send(204, '');
        if (req.method !== 'POST') return send(405, '{}');
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) return send(403, '{}');
        let body = '', size = 0;
        req.on('data', (c) => { size += c.length; if (size > 4e6) { req.destroy(); } else body += c; });
        req.on('end', () => {
          try {
            JSON.parse(body);
            mkdirSync(dir, { recursive: true });
            writeFileSync(`${file}.tmp`, body);
            renameSync(`${file}.tmp`, file);
            send(200, '{"ok":true}');
          } catch { send(400, '{}'); }
        });
      });
    },
  }, {
    name: 'third-party-notices',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_NOTICES.md', source: readFileSync('THIRD_PARTY_NOTICES.md', 'utf8') });
    },
  }],
});

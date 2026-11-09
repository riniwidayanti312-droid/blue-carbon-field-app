// Membangun dua versi dari sumber yang sama:
//   dist/index.html  -> artifact claude.ai
//   web/index.html   -> GitHub Pages (PWA + Supabase)
// Jalankan: node build.js   (dari folder src di repo: node build.js --web-only)
const fs = require('fs'); const path = require('path');
const D = __dirname; const r = f => fs.readFileSync(path.join(D, f), 'utf8');
const WEB_URL = 'https://riniwidayanti312-droid.github.io/blue-carbon-field-app/';
const ARTIFACT_URL = 'https://claude.ai/artifact/UMysNhDYZ2SU9TkD8rhH1x';
const PWA = `<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="BC Field">`;
function build(target) {
  const meta = JSON.parse(r('metadata.json'));
  meta.app.publicUrl = target === 'web' ? WEB_URL : ARTIFACT_URL;
  if (target !== 'web') { meta.sync.supabaseUrl = ''; meta.sync.supabaseAnonKey = ''; }
  let html = r('shell.html')
    .replace('<!--__PWA__-->', target === 'web' ? PWA : '')
    .replace('/*__CSS__*/', () => r('app.css'))
    .replace('/*__META__*/', () => JSON.stringify(meta, null, 2).replace(/<\//g, '<\\/'))
    .replace('/*__QRLIB__*/', () => r('qrlib.js'))
    .replace('/*__JS__*/', () => ['core.js', 'ui.js', 'views.js', 'supabase.js', 'services.js'].map(r).join('\n'));
  const ic = { MARK: 'mark', SYNC: 'sync', DATA: 'data', HOME: 'home', SURVEY: 'survey', SCAN: 'scan', SAMPLE: 'sample', LEAF: 'leaf' };
  for (const [k, v] of Object.entries(ic)) html = html.replace('__' + k + '__', `<i data-ic="${v}"></i>`);
  return html;
}
const webOnly = process.argv.includes('--web-only');
if (!webOnly) { fs.mkdirSync(path.join(D, 'dist'), { recursive: true }); fs.writeFileSync(path.join(D, 'dist/index.html'), build('artifact')); }
const webDir = webOnly ? path.join(D, '..') : path.join(D, 'web');
fs.writeFileSync(path.join(webDir, 'index.html'), build('web'));
console.log('built', webOnly ? 'web' : 'artifact + web');

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('📦 Empaquetador de Distribución · Radar Lite');
console.log('====================================================\n');

console.log('1. Compilando bundles de producción (Vite + esbuild)...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
console.log('✓ Compilación completada con éxito.\n');

const distPackageDir = path.resolve(rootDir, 'dist-package');
const appPackageDir = path.resolve(distPackageDir, 'radar-lite');
const zipFilePath = path.resolve(rootDir, 'radar-lite.zip');

if (fs.existsSync(distPackageDir)) {
  fs.rmSync(distPackageDir, { recursive: true, force: true });
}
if (fs.existsSync(zipFilePath)) {
  fs.rmSync(zipFilePath, { force: true });
}
fs.mkdirSync(appPackageDir, { recursive: true });

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

console.log('2. Copiando archivos limpios (sin credenciales)...');
copyRecursive(path.join(rootDir, 'dist'), path.join(appPackageDir, 'dist'));
copyRecursive(path.join(rootDir, 'public'), path.join(appPackageDir, 'public'));
fs.copyFileSync(path.join(rootDir, 'server.mjs'), path.join(appPackageDir, 'server.mjs'));
fs.copyFileSync(path.join(rootDir, 'iniciar.bat'), path.join(appPackageDir, 'iniciar.bat'));
fs.copyFileSync(path.join(rootDir, 'iniciar.sh'), path.join(appPackageDir, 'iniciar.sh'));
fs.copyFileSync(path.join(rootDir, 'README.md'), path.join(appPackageDir, 'README.md'));
fs.copyFileSync(path.join(rootDir, 'LEEME_PRIMERO.txt'), path.join(appPackageDir, 'LEEME_PRIMERO.txt'));
fs.copyFileSync(path.join(rootDir, '.env.example'), path.join(appPackageDir, '.env.example'));
fs.copyFileSync(path.join(rootDir, '.env.example'), path.join(appPackageDir, '.env'));

const prodPackageJson = {
  name: 'radar-lite',
  version: '1.0.0',
  description: 'Buscador y Auditor de Prospectos B2B con IA y Google Places',
  private: true,
  type: 'module',
  scripts: {
    start: 'node server.mjs',
  },
  dependencies: {
    '@google/genai': '^2.4.0',
    dotenv: '^17.2.3',
    express: '^4.21.2',
  },
};

fs.writeFileSync(
  path.join(appPackageDir, 'package.json'),
  JSON.stringify(prodPackageJson, null, 2),
  'utf-8'
);

console.log('3. Comprimiendo paquete en formato ZIP...');
execSync(`tar -a -cf "${zipFilePath}" -C "${distPackageDir}" radar-lite`, {
  cwd: rootDir,
  stdio: 'inherit',
});

const stat = fs.statSync(zipFilePath);
const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
console.log(`✓ Archivo ZIP generado con éxito: ${zipFilePath} (${sizeMb} MB)\n`);

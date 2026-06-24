const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf-8');

// Fix the original switchSceneImage - add null safety
code = code.replace(
  'function switchSceneImage(sceneType, template) {\n  const images = template?.sceneImages',
  'function switchSceneImage(sceneType, template) {\n  const img = dom.characterImage;\n  if (!img) return;\n  const images = template?.sceneImages'
);
code = code.replace(
  'if (dom.characterImage.src.endsWith(filename)) return;',
  'if (img.src && img.src.endsWith(filename)) return;'
);
code = code.replace(/dom\.characterImage\.classList/g, 'img.classList');
code = code.replace(/dom\.characterImage\.src/g, 'img.src');
code = code.replace(/setTimeout\(\(\) => img\.classList\.remove\('img-fade-in'\), 500\);/g, 'setTimeout(() => img.classList.remove(\'img-fade-in\'), 500);');

fs.writeFileSync('public/app.js', code);
console.log('Patched switchSceneImage');

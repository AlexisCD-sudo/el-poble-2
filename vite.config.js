// Configuració de Vite per publicar a GitHub Pages (https://alexiscd-sudo.github.io/el-poble-2/).
// `base` ha de coincidir amb el nom del repositori; sense això, a Pages les rutes dels fitxers apunten a l'arrel i la pàgina queda en blanc.
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/el-poble-2/',
});

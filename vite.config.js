import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // El único chunk grande es el core de three (~516 kB) y se carga bajo demanda al abrir
    // la vista 3D, no en el arranque. Sin este límite el warning de 500 kB es ruido
    // permanente que tapa avisos reales sobre el chunk inicial.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      // three y el CSG solo se necesitan en la vista 3D. En chunks separados para que no
      // lastren la carga inicial y para que actualizar uno no invalide la caché del otro.
      output: { manualChunks: { three: ['three'], csg: ['three-bvh-csg'] } }
    }
  }
});

import './style.css'
import { TypeGpuRenderer } from './type-gpu-renderer';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const renderer = new TypeGpuRenderer();

  const start = async () => {
    try {
      await renderer.initialize(app);

      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render();
      };

      window.addEventListener('resize', () => {
        renderer.resize(app.clientWidth, app.clientHeight);
      });

      animate();
    } catch (error) {
      console.error('Failed to initialize TypeGPU renderer:', error);
      app.innerHTML = `<div style="color: white; padding: 20px;">
        <h2>WebGPU Not Supported</h2>
        <p>Your browser doesn't seem to support WebGPU, or it is disabled. Please try using a modern browser like Chrome or Edge with WebGPU enabled.</p>
      </div>`;
    }
  };

  start();
}

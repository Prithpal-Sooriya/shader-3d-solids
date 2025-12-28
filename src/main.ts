import './style.css'
import { ThreeRenderer } from './three-renderer';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const renderer = new ThreeRenderer();
  renderer.initialize(app);

  const animate = () => {
    requestAnimationFrame(animate);
    renderer.render();
  };

  window.addEventListener('resize', () => {
    renderer.resize(app.clientWidth, app.clientHeight);
  });

  animate();
}

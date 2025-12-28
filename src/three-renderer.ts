import * as THREE from 'three';
import type { CubeRenderer } from './renderer';
import { AsciiShader, createAsciiTexture } from './ascii-shader';

export class ThreeRenderer implements CubeRenderer {
    private container: HTMLElement | null = null;
    private renderer: THREE.WebGLRenderer | null = null;
    private scene: THREE.Scene | null = null;
    private camera: THREE.PerspectiveCamera | null = null;
    private cube: THREE.Mesh | null = null;

    // Post-processing
    private renderTarget: THREE.WebGLRenderTarget | null = null;
    private postScene: THREE.Scene | null = null;
    private postCamera: THREE.OrthographicCamera | null = null;
    private postMaterial: THREE.ShaderMaterial | null = null;

    // Resources to dispose
    private geometry: THREE.BoxGeometry | null = null;
    private material: THREE.MeshBasicMaterial | null = null;

    // Interaction
    private isDragging = false;
    private previousMousePosition = { x: 0, y: 0 };
    private targetRotation = { x: 0, y: 0 };
    private currentRotation = { x: 0, y: 0 };

    initialize(container: HTMLElement): void {
        this.container = container;

        // 1. Setup Main Scene
        this.scene = new THREE.Scene();
        this.scene.background = null;

        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        this.camera.position.z = 2.8; // Zoomed out for more breathing room

        this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setClearColor(0x000000, 0); // Transparent clear color
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        // 2. Create Cube
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load('/mona.jpg');
        // Important: Textures for ASCII effect usually work best with good contrast
        texture.colorSpace = THREE.SRGBColorSpace;

        // Using a basic material so the brightness maps directly to ASCII characters
        // White cube = dense characters, Black cube = sparse characters
        this.material = new THREE.MeshBasicMaterial({
            map: texture,
            color: 0xffffff
        });

        this.geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6); // Slightly larger
        this.cube = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(this.cube);

        // 3. Setup Post-Processing
        this.renderTarget = new THREE.WebGLRenderTarget(
            container.clientWidth * window.devicePixelRatio,
            container.clientHeight * window.devicePixelRatio,
            {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
            }
        );

        this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.postScene = new THREE.Scene();

        const fontTexture = createAsciiTexture();

        this.postMaterial = new THREE.ShaderMaterial({
            vertexShader: AsciiShader.vertexShader,
            fragmentShader: AsciiShader.fragmentShader,
            uniforms: THREE.UniformsUtils.clone(AsciiShader.uniforms),
        });

        this.postMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;
        this.postMaterial.uniforms.tFont.value = fontTexture;
        this.postMaterial.uniforms.uResolution.value.set(
            container.clientWidth * window.devicePixelRatio,
            container.clientHeight * window.devicePixelRatio
        );
        // Tweak font size to match reference
        // Smaller font size = higher resolution ASCII
        this.postMaterial.uniforms.uFontSize.value = 10.0 * window.devicePixelRatio;

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
        this.postScene.add(quad);

        // 4. Interaction Listeners
        this.setupInteraction();
    }

    private setupInteraction(): void {
        if (!this.container) return;

        this.container.addEventListener('mousedown', this.onMouseDown);
        this.container.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);

        // Keyboard controls
        window.addEventListener('keydown', this.onKeyDown);
    }

    private onMouseDown = (e: MouseEvent) => {
        this.isDragging = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
        if (this.container) this.container.style.cursor = 'grabbing';
    };

    private onMouseMove = (e: MouseEvent) => {
        if (this.isDragging) {
            const deltaMove = {
                x: e.clientX - this.previousMousePosition.x,
                y: e.clientY - this.previousMousePosition.y
            };

            // Update target rotation
            this.targetRotation.x += deltaMove.y * 0.01;
            this.targetRotation.y += deltaMove.x * 0.01;

            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        }
    };

    private onMouseUp = () => {
        this.isDragging = false;
        if (this.container) this.container.style.cursor = 'grab';
    };

    private onKeyDown = (e: KeyboardEvent) => {
        const SPEED = 0.1;
        if (e.key === 'ArrowUp') this.targetRotation.x -= SPEED;
        if (e.key === 'ArrowDown') this.targetRotation.x += SPEED;
        if (e.key === 'ArrowLeft') this.targetRotation.y -= SPEED;
        if (e.key === 'ArrowRight') this.targetRotation.y += SPEED;
    };

    resize(width: number, height: number): void {
        if (!this.renderer || !this.camera || !this.renderTarget || !this.postMaterial) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.renderTarget.setSize(width * window.devicePixelRatio, height * window.devicePixelRatio);

        this.postMaterial.uniforms.uResolution.value.set(
            width * window.devicePixelRatio,
            height * window.devicePixelRatio
        );
    }

    render(): void {
        if (!this.renderer || !this.scene || !this.camera || !this.cube || !this.renderTarget || !this.postScene || !this.postCamera) return;

        // Smooth rotation interpolation
        this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.1;
        this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.1;

        // Auto rotate if not dragging (optional, matches the ref site's slow idle spin)
        if (!this.isDragging) {
            this.targetRotation.y += 0.002;
            this.targetRotation.x += 0.001;
        }

        this.cube.rotation.x = this.currentRotation.x;
        this.cube.rotation.y = this.currentRotation.y;

        // 1. Render Scene to RenderTarget
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);

        // 2. Render Post-Processing Quad to Screen
        this.renderer.setRenderTarget(null);
        this.renderer.clear();
        this.renderer.render(this.postScene, this.postCamera);
    }

    destroy(): void {
        // Cleanup listeners and dispose three.js objects
        if (this.container) {
            this.container.removeEventListener('mousedown', this.onMouseDown);
            this.container.removeEventListener('mousemove', this.onMouseMove);
        }
        window.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('keydown', this.onKeyDown);

        this.geometry?.dispose();
        this.material?.dispose();
        this.renderer?.dispose();
        // ... more thorough cleanup if needed
    }
}

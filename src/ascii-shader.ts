import * as THREE from 'three';

// The character set used for the ASCII effect, sorted roughly by density.
// We can tweak this to match the GitHub shop look more closely.
// They seem to use: . < > ^ v / \ # and maybe others.
// Let's try a standard density ramp first, then refine.
// Refined character set based on user's exact reversed requirement: .:-=+*%#@
// Mapping low intensity to '.' which the user identified as the most common character
const CHAR_SET = ".:-=+*%#@";

export function createAsciiTexture(): THREE.Texture {
    const fontSize = 64;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Could not create 2D context for ASCII texture');
    }

    // Calculate grid size
    const charCount = CHAR_SET.length;
    // We'll arrange characters in a horizontal strip for simplicity in the shader
    // Or a grid. A strip is easier: u = charIndex / charCount + (u_in_char / charCount)
    // Let's make a texture that is (charCount * fontSize) x fontSize

    canvas.width = charCount * fontSize;
    canvas.height = fontSize;

    // Fill background with black (transparent might be tricky if we want to overwrite)
    // The shader usually expects a solid color on top of a background. 
    // For this effect, the font texture usually contains white text on transparent (or black) background.
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = `bold ${fontSize}px monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';

    for (let i = 0; i < charCount; i++) {
        const char = CHAR_SET[i];
        const x = i * fontSize + fontSize / 2;
        const y = fontSize / 2;
        context.fillText(char, x, y);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;

    return texture;
}

export const AsciiShader = {
    uniforms: {
        tDiffuse: { value: null }, // The rendered 3D scene
        tFont: { value: null },    // Our ASCII font atlas
        uCharCount: { value: CHAR_SET.length },
        uResolution: { value: new THREE.Vector2() },
        uFontSize: { value: 10.0 }, // Size of one character in screen pixels
        uColor: { value: new THREE.Color('#ffffff') }, // Main text color
        uBgColor: { value: new THREE.Color('#000000') }, // Background color
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tFont;
    uniform float uCharCount;
    uniform vec2 uResolution;
    uniform float uFontSize;
    uniform vec3 uColor;
    uniform vec3 uBgColor;

    varying vec2 vUv;

    void main() {
      // 1. Pixelate UVs to grid coordinates
      // Number of characters that fit horizontally and vertically
      vec2 gridDims = uResolution / uFontSize;
      
      // Calculate the center of the current cell in UV space
      vec2 cellUv = floor(vUv * gridDims) / gridDims;
      
      // 2. Sample luminance from the scene at the cell center
      vec4 sceneColor = texture2D(tDiffuse, cellUv);
      // Invert luminance so that dark areas (or vice versa depending on texture) 
      // map to the desired density. User wants faces (background) to be '.' 
      // and logo to be filled.
      float luminance = 1.0 - dot(sceneColor.rgb, vec3(0.299, 0.587, 0.114));
      
      // 3. Map luminance to a character index
      // luminance 0 -> index 0 (lowest density)
      // luminance 1 -> index N (highest density)
      float charIndex = floor(luminance * (uCharCount - 1.0));
      
      // 4. Calculate UV within the font texture
      // We need to map the current pixel's position within the cell to the character's position in the atlas
      
      // Fraction within the current cell (0.0 to 1.0)
      vec2 uvInCell = fract(vUv * gridDims);
      
      // Map u coordinate to the specific character in the strip
      // The strip is [char0 | char1 | char2 ... ]
      // u = (charIndex + uvInCell.x) / uCharCount
      float fontU = (charIndex + uvInCell.x) / uCharCount;
      float fontV = uvInCell.y; // Single row, so V is just 0..1
      
      // 5. Sample the font texture
      vec4 fontColor = texture2D(tFont, vec2(fontU, fontV));
      
      // 6. Output final color
      // Use the scene's alpha to mask the effect (transparency outside the cube)
      // and use the font brightness for the text color.
      gl_FragColor = vec4(uColor, fontColor.r * sceneColor.a);
    }
  `
};

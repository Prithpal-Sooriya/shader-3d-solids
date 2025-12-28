import { f32, vec2f, vec3f, struct } from 'typegpu/data';

const CHAR_SET = ".:-=+*%#@";

export function createAsciiTexture(device: GPUDevice): GPUTexture {
    const fontSize = 64;
    const charCount = CHAR_SET.length;
    const width = charCount * fontSize;
    const height = fontSize;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Could not create 2D context for ASCII texture');
    }

    context.fillStyle = '#000000';
    context.fillRect(0, 0, width, height);
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

    const texture = device.createTexture({
        size: [width, height, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    device.queue.copyExternalImageToTexture(
        { source: canvas },
        { texture: texture },
        [width, height]
    );

    return texture;
}

export const AsciiParams = struct({
    uCharCount: f32,
    uFontSize: f32,
    uResolution: vec2f,
    uColor: vec3f,
    uBgColor: vec3f,
});

export const asciiVertexShader = `
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn main(@location(0) pos: vec2f) -> VertexOutput {
    var out: VertexOutput;
    out.position = vec4f(pos, 0.0, 1.0);
    out.uv = (pos + 1.0) * 0.5;
    out.uv.y = 1.0 - out.uv.y; // Flip Y for screen space
    return out;
}
`;

export const asciiFragmentShader = `
@group(0) @binding(0) var tDiffuse: texture_2d<f32>;
@group(0) @binding(1) var tFont: texture_2d<f32>;
@group(0) @binding(2) var sSampler: sampler;
@group(0) @binding(3) var<uniform> params: AsciiParams;

struct AsciiParams {
    uCharCount: f32,
    uFontSize: f32,
    uResolution: vec2f,
    uColor: vec3f,
    uBgColor: vec3f,
}

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
    let gridDims = params.uResolution / params.uFontSize;
    let cellUv = floor(uv * gridDims) / gridDims;
    
    let sceneColor = textureSample(tDiffuse, sSampler, cellUv);
    let luminance = 1.0 - dot(sceneColor.rgb, vec3f(0.299, 0.587, 0.114));
    
    let charIndex = floor(luminance * (params.uCharCount - 1.0));
    let uvInCell = fract(uv * gridDims);
    
    let fontU = (charIndex + uvInCell.x) / params.uCharCount;
    let fontV = uvInCell.y;
    
    let fontColor = textureSample(tFont, sSampler, vec2f(fontU, fontV));
    
    return vec4f(sceneColor.rgb * fontColor.r, sceneColor.a * fontColor.r);
}
`;

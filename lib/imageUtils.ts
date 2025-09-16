/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Helper function to load an image and return it as an HTMLImageElement
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error(`Failed to load image: ${src.substring(0, 50)}...`));
        img.src = src;
    });
}

/**
 * Adds a watermark to an image.
 * @param imageUrl The data URL of the image to watermark.
 * @returns A promise that resolves to a data URL of the watermarked image (JPEG format).
 */
export async function addWatermark(imageUrl: string): Promise<string> {
    const img = await loadImage(imageUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not get 2D canvas context');
    }

    // Draw the original image
    ctx.drawImage(img, 0, 0);

    // Prepare watermark text
    const watermarkText = 'psule.app';
    const padding = Math.max(20, canvas.width * 0.02); // 2% padding or 20px minimum
    const fontSize = Math.max(18, canvas.width * 0.03); // 3% font size or 18px minimum

    ctx.font = `${fontSize}px 'Roboto', sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    // Draw a subtle shadow for better readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    // Draw text in the bottom right corner
    ctx.fillText(watermarkText, canvas.width - padding, canvas.height - padding);

    return canvas.toDataURL('image/jpeg', 0.9);
}
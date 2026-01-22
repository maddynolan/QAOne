/**
 * Element Cropper
 * 
 * Crops screenshots to show element + surrounding context.
 * Uses pure JavaScript image manipulation (no external dependencies).
 * 
 * @author Flowstral QA Team
 * @version 1.0.0
 */

class ElementCropper {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.log = this.debug ? console.log.bind(console, '[ElementCropper]') : () => {};
  }

  /**
   * Crop a screenshot buffer around a bounding box
   * 
   * Note: This is a simplified version that stores crop metadata.
   * For actual pixel cropping, we'd need sharp or jimp.
   * We store the full image but mark the region of interest.
   * 
   * @param {Buffer} imageBuffer - PNG image buffer
   * @param {Object} boundingBox - { x, y, width, height }
   * @param {Object} options - { padding: number }
   * @returns {Object} Cropped image data with metadata
   */
  async crop(imageBuffer, boundingBox, options = {}) {
    const padding = options.padding || 50;

    try {
      // Calculate crop area with padding
      const cropArea = {
        left: Math.max(0, Math.floor(boundingBox.x - padding)),
        top: Math.max(0, Math.floor(boundingBox.y - padding)),
        width: Math.ceil(boundingBox.width + padding * 2),
        height: Math.ceil(boundingBox.height + padding * 2)
      };

      this.log('Crop area:', cropArea);

      // Return the full buffer with crop metadata
      // In production, you'd use sharp here:
      // const cropped = await sharp(imageBuffer)
      //   .extract(cropArea)
      //   .toBuffer();
      
      return {
        buffer: imageBuffer,
        cropArea,
        originalBoundingBox: boundingBox,
        isCropped: false, // Set to true if actual cropping is performed
        padding
      };
    } catch (e) {
      this.log('Crop calculation failed:', e.message);
      return {
        buffer: imageBuffer,
        cropArea: null,
        originalBoundingBox: boundingBox,
        isCropped: false,
        error: e.message
      };
    }
  }

  /**
   * Add visual highlighting to indicate the element location
   * Returns metadata for UI to draw overlay
   */
  getHighlightRegion(boundingBox, imageWidth, imageHeight, padding = 50) {
    return {
      x: Math.max(0, boundingBox.x - padding),
      y: Math.max(0, boundingBox.y - padding),
      width: Math.min(imageWidth, boundingBox.width + padding * 2),
      height: Math.min(imageHeight, boundingBox.height + padding * 2),
      elementBox: boundingBox
    };
  }
}

module.exports = ElementCropper;

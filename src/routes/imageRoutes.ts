import { Router } from 'express';
import { OptimizedS3Service } from '../utils/enhancedS3Service';
import { logger } from '../lib/logger';
import sharp from 'sharp';
import path from 'path';

const imageRoutes = Router();

// Test endpoint
imageRoutes.post('/test-upload', async (req, res) => {
  try {
    // Create a simple test SVG
    const svgBuffer = Buffer.from(`
      <svg width="100" height="100">
        <rect width="100" height="100" fill="red"/>
      </svg>
    `);

    // Process with Sharp
    const processedBuffer = await sharp(svgBuffer)
      .resize(100, 100)
      .toBuffer();

    console.log('Image processed successfully');
    
    const key = await OptimizedS3Service.uploadImage(
      processedBuffer,
      'test-business',
      'test-photo-' + Date.now()
    );
    
    res.json({ 
      success: true,
      key,
      message: 'Test image uploaded successfully'
    });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ 
      message: 'Failed to upload test image',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

imageRoutes.get('/:key(*)/url', async (req, res) => {
    try {
      const { key } = req.params;
      console.log('Requesting URL for key:', key); // Debug log
      const url = await OptimizedS3Service.getImageUrl(key);
      res.json({ url });
    } catch (error) {
      console.error('Error generating URL:', error);
      res.status(500).json({ 
        message: 'Failed to generate image URL',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

export default imageRoutes;
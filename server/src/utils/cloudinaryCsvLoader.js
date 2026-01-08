import { v2 as cloudinary } from 'cloudinary';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Download CSV file from Cloudinary
 * @param {string} fileName - 'league_mapping_clean' or 'league_mapping_with_urls'
 * @returns {Promise<string>} - CSV content as string
 */
export async function downloadCsvFromCloudinary(fileName) {
    try {
        // Check if Cloudinary credentials are configured
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.log(`[CloudinaryCSV] ⚠️ Cloudinary credentials not configured, falling back to local file`);
            return downloadFromLocalFile(fileName);
        }

        // Build Cloudinary URL with cache-busting timestamp
        // ✅ Use correct public_id format: league-mapping/filename.csv
        const publicId = `league-mapping/${fileName}.csv`;
        const timestamp = Date.now();
        let url = cloudinary.url(publicId, {
            resource_type: 'raw',
            format: 'csv'
        });
        
        // ✅ Add cache-busting query parameter to force fresh download
        url = `${url}?_cb=${timestamp}`;

        console.log(`[CloudinaryCSV] 📥 Downloading ${fileName} from Cloudinary...`);
        console.log(`[CloudinaryCSV] URL: ${url}`);

        // Download CSV content
        const response = await axios.get(url, {
            timeout: 10000, // 10 second timeout
            responseType: 'text'
        });

        if (response.status === 200 && response.data) {
            console.log(`[CloudinaryCSV] ✅ Downloaded ${fileName} from Cloudinary (${response.data.length} bytes)`);
            return response.data;
        } else {
            throw new Error(`Failed to download: HTTP ${response.status}`);
        }
    } catch (error) {
        console.error(`[CloudinaryCSV] ❌ Error downloading ${fileName} from Cloudinary:`, error.message);
        
        // Fallback: Try to read from local file if Cloudinary fails
        return downloadFromLocalFile(fileName);
    }
}

/**
 * Fallback: Download from local file
 */
function downloadFromLocalFile(fileName) {
    try {
        const localPath = path.join(__dirname, `../unibet-calc/${fileName}.csv`);
        
        if (fs.existsSync(localPath)) {
            console.log(`[CloudinaryCSV] ⚠️ Falling back to local file: ${localPath}`);
            const content = fs.readFileSync(localPath, 'utf-8');
            console.log(`[CloudinaryCSV] ✅ Loaded ${fileName} from local file (${content.length} bytes)`);
            return content;
        }
        
        throw new Error(`Local file not found: ${localPath}`);
    } catch (error) {
        console.error(`[CloudinaryCSV] ❌ Error loading local file:`, error.message);
        throw error;
    }
}

/**
 * Download league_mapping_clean.csv from Cloudinary
 */
export async function downloadLeagueMappingClean() {
    return downloadCsvFromCloudinary('league_mapping_clean');
}

/**
 * Download league_mapping_with_urls.csv from Cloudinary
 */
export async function downloadLeagueMappingWithUrls() {
    return downloadCsvFromCloudinary('league_mapping_with_urls');
}

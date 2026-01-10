import "dotenv/config";
import connectDB from '../config/database.js';
import LeagueMapping from '../models/LeagueMapping.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Add Is_Verified column to CSV files and isVerified attribute to database
 */
async function addIsVerifiedColumn() {
    try {
        console.log('🔄 Starting addition of Is_Verified column...');
        
        // Connect to database
        await connectDB();
        console.log('✅ Connected to MongoDB');
        
        // Update all existing records in database to have isVerified: true
        const updateResult = await LeagueMapping.updateMany(
            {},
            { $set: { isVerified: true } }
        );
        console.log(`✅ Updated ${updateResult.modifiedCount} records in database with isVerified: true`);
        
        // Update CSV files
        const csvFiles = [
            {
                path: path.join(__dirname, '../unibet-calc/league_mapping_clean.csv'),
                name: 'league_mapping_clean.csv'
            },
            {
                path: path.join(__dirname, '../unibet-calc/league_mapping_with_urls.csv'),
                name: 'league_mapping_with_urls.csv'
            }
        ];
        
        for (const csvFile of csvFiles) {
            if (!fs.existsSync(csvFile.path)) {
                console.log(`⚠️  CSV file not found: ${csvFile.path}`);
                continue;
            }
            
            try {
                let csvContent = fs.readFileSync(csvFile.path, 'utf-8');
                const lines = csvContent.split('\n').filter(line => line.trim() !== '');
                
                if (lines.length === 0) {
                    console.log(`⚠️  Empty CSV file: ${csvFile.name}`);
                    continue;
                }
                
                // Update header - add Is_Verified column at the end
                const header = lines[0];
                if (header.includes('Is_Verified')) {
                    console.log(`ℹ️  ${csvFile.name} already has Is_Verified column, skipping...`);
                    continue;
                }
                
                const newHeader = header + ',Is_Verified';
                
                // Update data rows - add "true" at the end
                const dataLines = lines.slice(1).map(line => {
                    if (!line.trim()) return line;
                    return line + ',true';
                });
                
                const newCsvContent = [newHeader, ...dataLines].join('\n');
                fs.writeFileSync(csvFile.path, newCsvContent, 'utf-8');
                
                console.log(`✅ Updated ${csvFile.name}: Added Is_Verified column (${dataLines.length} rows)`);
            } catch (error) {
                console.error(`❌ Error updating ${csvFile.name}:`, error.message);
            }
        }
        
        console.log('\n✅ Addition complete!');
        console.log(`📊 Summary:`);
        console.log(`   - Database: ${updateResult.modifiedCount} records updated`);
        console.log(`   - CSV files: 2 files updated`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Addition failed:', error);
        process.exit(1);
    }
}

// Run addition
addIsVerifiedColumn();

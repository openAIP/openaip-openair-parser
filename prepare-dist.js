import { promises as fs } from 'fs';
import * as path from 'path';

const cjsFolder = './dist/cjs';

async function renameFiles(folderPath) {
    try {
        const files = await fs.readdir(folderPath);

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stat = await fs.stat(filePath);

            if (stat.isDirectory()) {
                // recursively process subdirectories
                await renameFiles(filePath);
            } else {
                // rename .js to .cjs and .d.ts to .d.cts
                if (file.endsWith('.js')) {
                    const newPath = filePath.replace(/\.js$/, '.cjs');
                    await fs.rename(filePath, newPath);
                    console.log(`Renamed: ${filePath} → ${newPath}`);
                } else if (file.endsWith('.d.ts')) {
                    const newPath = filePath.replace(/\.d\.ts$/, '.d.cts');
                    await fs.rename(filePath, newPath);
                    console.log(`Renamed: ${filePath} → ${newPath}`);
                }
            }
        }
    } catch (error) {
        console.error('Error renaming files:', error);
    }
}

async function updateRequireStatements(folderPath) {
    try {
        const files = await fs.readdir(folderPath);

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stat = await fs.stat(filePath);

            if (stat.isDirectory()) {
                // recursively process subdirectories
                await updateRequireStatements(filePath);
            } else if (file.endsWith('.cjs') || file.endsWith('.d.cts')) {
                try {
                    const data = await fs.readFile(filePath, 'utf8');

                    // replace extensions in require, import, and export statements
                    const updatedContent = data
                        // handle TypeScript imports in .d.cts files
                        .replace(/from\s+(['"])(.+?)\.js(['"]);/g, (_, quote1, path, quote2) => {
                            return `from ${quote1}${path}.cjs${quote2};`;
                        })
                        .replace(/from\s+(['"])(.+?)\.d\.ts(['"]);/g, (_, quote1, path, quote2) => {
                            return `from ${quote1}${path}.d.cts${quote2};`;
                        })
                        // handle CommonJS requires in .cjs files
                        .replace(/require\((['"])(.+?)\.js(['"'])\)/g, (_, quote1, path, quote2) => {
                            return `require(${quote1}${path}.cjs${quote2})`;
                        })
                        .replace(/require\((['"])(.+?)\.d\.ts(['"'])\)/g, (_, quote1, path, quote2) => {
                            return `require(${quote1}${path}.d.cts${quote2})`;
                        })
                        // handle type imports in .d.cts files
                        .replace(/import\s+type\s*{[^}]+}\s+from\s+(['"])(.+?)\.js(['"]);/g, (match, _, path) => {
                            return match.replace(`${path}.js`, `${path}.cjs`);
                        })
                        .replace(/import\s+type\s*{[^}]+}\s+from\s+(['"])(.+?)\.d\.ts(['"]);/g, (match, _, path) => {
                            return match.replace(`${path}.d.ts`, `${path}.d.cts`);
                        });

                    if (updatedContent !== data) {
                        await fs.writeFile(filePath, updatedContent, 'utf8');
                        console.log(`Updated imports/requires in: ${filePath}`);
                    }
                } catch (error) {
                    console.error(`Error processing file ${filePath}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Could not read directory:', error);
    }
}

async function main() {
    try {
        console.log('Step 1: Renaming files...');
        await renameFiles(cjsFolder);
        console.log('\nStep 2: Updating import and require statements...');
        await updateRequireStatements(cjsFolder);
        console.log('\nProcess completed successfully!');
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

main();

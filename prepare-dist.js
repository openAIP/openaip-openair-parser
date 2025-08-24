import { promises as fs } from 'fs';
import * as path from 'path';

/* global console, process */

const cjsFolder = './dist/cjs';
const esmFolder = './dist/esm';

async function renameFiles(folderPath, isEsm = false) {
    try {
        const files = await fs.readdir(folderPath);

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stat = await fs.stat(filePath);

            if (stat.isDirectory()) {
                // recursively process subdirectories
                await renameFiles(filePath, isEsm);
            } else {
                if (isEsm) {
                    // rename .js to .mjs and .d.ts to .d.mts for ESM
                    if (file.endsWith('.js')) {
                        const newPath = filePath.replace(/\.js$/, '.mjs');
                        await fs.rename(filePath, newPath);
                        console.log(`Renamed: ${filePath} → ${newPath}`);
                    } else if (file.endsWith('.d.ts')) {
                        const newPath = filePath.replace(/\.d\.ts$/, '.d.mts');
                        await fs.rename(filePath, newPath);
                        console.log(`Renamed: ${filePath} → ${newPath}`);
                    }
                } else {
                    // rename .js to .cjs and .d.ts to .d.cts for CJS
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
        }
    } catch (error) {
        console.error('Error renaming files:', error);
    }
}

async function updateRequireStatements(folderPath, isEsm = false) {
    try {
        const files = await fs.readdir(folderPath);

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stat = await fs.stat(filePath);

            if (stat.isDirectory()) {
                // recursively process subdirectories
                await updateRequireStatements(filePath, isEsm);
            } else {
                const isValidFile = isEsm
                    ? (file.endsWith('.mjs') || file.endsWith('.d.mts'))
                    : (file.endsWith('.cjs') || file.endsWith('.d.cts'));

                if (isValidFile) {
                    try {
                        const data = await fs.readFile(filePath, 'utf8');
                        const targetExt = isEsm ? '.mjs' : '.cjs';
                        const targetDExt = isEsm ? '.d.mts' : '.d.cts';

                        // replace extensions in require, import, and export statements
                        const updatedContent = data
                            // handle TypeScript imports
                            .replace(/from\s+(['"])(.+?)\.js(['"]);/g, (_, quote1, path, quote2) => {
                                return `from ${quote1}${path}${targetExt}${quote2};`;
                            })
                            .replace(/from\s+(['"])(.+?)\.d\.ts(['"]);/g, (_, quote1, path, quote2) => {
                                return `from ${quote1}${path}${targetDExt}${quote2};`;
                            })
                            // handle CommonJS requires (only for CJS files)
                            .replace(/require\((['"])(.+?)\.js(['"'])\)/g, (_, quote1, path, quote2) => {
                                return `require(${quote1}${path}${targetExt}${quote2})`;
                            })
                            .replace(/require\((['"])(.+?)\.d\.ts(['"'])\)/g, (_, quote1, path, quote2) => {
                                return `require(${quote1}${path}${targetDExt}${quote2})`;
                            })
                            // handle type imports
                            .replace(/import\s+type\s*{[^}]+}\s+from\s+(['"])(.+?)\.js(['"]);/g, (match, _, path) => {
                                return match.replace(`${path}.js`, `${path}${targetExt}`);
                            })
                            .replace(/import\s+type\s*{[^}]+}\s+from\s+(['"])(.+?)\.d\.ts(['"]);/g, (match, _, path) => {
                                return match.replace(`${path}.d.ts`, `${path}${targetDExt}`);
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
        }
    } catch (error) {
        console.error('Could not read directory:', error);
    }
}

async function main() {
    try {
        console.log('Step 1: Renaming CJS files...');
        await renameFiles(cjsFolder, false);
        console.log('\nStep 2: Renaming ESM files...');
        await renameFiles(esmFolder, true);

        console.log('\nStep 3: Updating CJS import/require statements...');
        await updateRequireStatements(cjsFolder, false);
        console.log('\nStep 4: Updating ESM import statements...');
        await updateRequireStatements(esmFolder, true);

        console.log('\nStep 5: Creating package.json files...');
        await fs.writeFile(
            path.join(cjsFolder, 'package.json'),
            JSON.stringify(
                {
                    type: 'commonjs',
                },
                null,
                2
            )
        );
        await fs.writeFile(
            path.join(esmFolder, 'package.json'),
            JSON.stringify(
                {
                    type: 'module',
                },
                null,
                2
            )
        );

        console.log('\nProcess completed successfully!');
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

main();

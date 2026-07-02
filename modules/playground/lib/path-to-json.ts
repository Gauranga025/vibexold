import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents a file in the template structure.
 *
 * `path` is the canonical, root-relative identifier for this file
 * (e.g. "app/dashboard/page.tsx"). It is the single source of truth
 * for "which file is this" everywhere in the app — filename/fileExtension
 * are display metadata only and must never be used to identify a file,
 * since multiple files can share the same filename+extension in different
 * folders (e.g. "app/page.tsx" vs "app/dashboard/page.tsx").
 */
export interface TemplateFile {
  filename: string;
  fileExtension: string;
  content: string;
  /** Canonical, root-relative path. Stable identity for this file. */
  path: string;
}

/**
 * Represents a folder in the template structure which can contain files and other folders.
 *
 * `path` is the canonical, root-relative identifier for this folder
 * (e.g. "app/dashboard"). The root folder itself has path "".
 */
export interface TemplateFolder {
  folderName: string;
  /** Canonical, root-relative path. "" for the root folder. */
  path: string;
  items: (TemplateFile | TemplateFolder)[];
}

/**
 * Type representing either a file or folder in the template structure
 */
export type TemplateItem = TemplateFile | TemplateFolder;

/**
 * Options for scanning template directories
 */
interface ScanOptions {
  /**
   * Files to ignore (exact filenames with extensions)
   */
  ignoreFiles?: string[];
  
  /**
   * Folders to ignore (exact folder names)
   */
  ignoreFolders?: string[];
  
  /**
   * File patterns to ignore (regex patterns)
   */
  ignorePatterns?: RegExp[];
  
  /**
   * Maximum size of file to include content (in bytes)
   * Files larger than this will have a placeholder message instead of content
   */
  maxFileSize?: number;
}

/**
 * Scans a template directory and returns a structured JSON representation
 * 
 * @param templatePath - Path to the template directory
 * @param options - Scanning options to customize behavior
 * @returns Promise resolving to the template structure as JSON
 */
export async function scanTemplateDirectory(
  templatePath: string,
  options: ScanOptions = {}
): Promise<TemplateFolder> {
  // Set default options
  const defaultOptions: ScanOptions = {
    // package-lock.json is intentionally NOT ignored: excluding it forced every
    // WebContainer session to run `npm install` with no lockfile, i.e. full
    // dependency-tree resolution against the registry on every run instead of a
    // fast, deterministic `npm ci`. yarn.lock is still ignored because every
    // starter's install step is hardcoded to `npm install` (webcontainer-preview.tsx),
    // so a yarn lockfile is never consumed here. npm-shrinkwrap.json was never in
    // this list to begin with, so no change was needed for it.
    ignoreFiles: [
      'yarn.lock',
      '.DS_Store',
      'thumbs.db',
      '.gitignore',
      '.npmrc',
      '.yarnrc',
      '.env',
      '.env.local',
      '.env.development',
      '.env.production'
    ],
    ignoreFolders: [
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'dist',
      'build',
      'coverage'
    ],
    ignorePatterns: [
      /^\..+\.swp$/,  // Vim swap files
      /^\.#/,         // Emacs backup files
      /~$/            // Backup files
    ],
    maxFileSize: 1024 * 1024 // 1MB
  };
  
  // Merge provided options with defaults
  const mergedOptions: ScanOptions = {
    ignoreFiles: [...(defaultOptions.ignoreFiles || []), ...(options.ignoreFiles || [])],
    ignoreFolders: [...(defaultOptions.ignoreFolders || []), ...(options.ignoreFolders || [])],
    ignorePatterns: [...(defaultOptions.ignorePatterns || []), ...(options.ignorePatterns || [])],
    maxFileSize: options.maxFileSize !== undefined ? options.maxFileSize : defaultOptions.maxFileSize
  };

  // Validate the input path
  if (!templatePath) {
    throw new Error('Template path is required');
  }

  // Check if the template path exists
  try {
    const stats = await fs.promises.stat(templatePath);
    if (!stats.isDirectory()) {
      throw new Error(`'${templatePath}' is not a directory`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Template directory '${templatePath}' does not exist`);
    }
    throw error;
  }

  // Get the folder name from the path
  const folderName = path.basename(templatePath);

  // Process the directory and return the result.
  // The root folder's canonical path is "" — every descendant path is
  // relative to it, e.g. an "app/page.tsx" file lives at relativePath
  // "app/page.tsx", not "<folderName>/app/page.tsx". This matches how
  // the rest of the app addresses files (root folder name is never part
  // of an id).
  return processDirectory(folderName, templatePath, '', mergedOptions);
}

/**
 * Process a directory and its contents recursively
 * 
 * @param folderName - Name of the current folder
 * @param folderPath - Filesystem path to the current folder
 * @param relativePath - Canonical, root-relative path of the current folder ("" for the root)
 * @param options - Scanning options
 * @returns Promise resolving to a TemplateFolder object
 */
async function processDirectory(
  folderName: string, 
  folderPath: string, 
  relativePath: string,
  options: ScanOptions
): Promise<TemplateFolder> {
  try {
    // Read directory contents
    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
    const items: TemplateItem[] = [];

    // Process each entry in the directory
    for (const entry of entries) {
      const entryName = entry.name;
      const entryPath = path.join(folderPath, entryName);
      // Canonical path of this entry, relative to the scan root.
      const entryRelativePath = relativePath ? `${relativePath}/${entryName}` : entryName;

      // Check if this entry should be skipped
      if (entry.isDirectory()) {
        // Skip ignored folders
        if (options.ignoreFolders?.includes(entryName)) {
          console.log(`Skipping ignored folder: ${entryPath}`);
          continue;
        }
        
        // If it's a directory, process it recursively
        const subFolder = await processDirectory(entryName, entryPath, entryRelativePath, options);
        items.push(subFolder);
      } else if (entry.isFile()) {
        // Skip ignored files
        if (options.ignoreFiles?.includes(entryName)) {
          console.log(`Skipping ignored file: ${entryPath}`);
          continue;
        }
        
        // Check against regex patterns
        const shouldSkip = options.ignorePatterns?.some(pattern => pattern.test(entryName));
        if (shouldSkip) {
          console.log(`Skipping file matching ignore pattern: ${entryPath}`);
          continue;
        }
        
        // If it's a file, get its details
        try {
          const stats = await fs.promises.stat(entryPath);
          const parsedPath = path.parse(entryName);
          let content: string;
          
          // Check file size before reading content
          if (options.maxFileSize && stats.size > options.maxFileSize) {
            content = `[File content not included: size (${stats.size} bytes) exceeds maximum allowed size (${options.maxFileSize} bytes)]`;
          } else {
            content = await fs.promises.readFile(entryPath, 'utf8');
          }
          
          items.push({
            filename: parsedPath.name,
            fileExtension: parsedPath.ext.replace(/^\./, ''), // Remove leading dot
            content,
            path: entryRelativePath
          });
        } catch (error) {
          console.error(`Error reading file ${entryPath}:`, error);
          // Still include the file but with an error message as content
          const parsedPath = path.parse(entryName);
          items.push({
            filename: parsedPath.name,
            fileExtension: parsedPath.ext.replace(/^\./, ''),
            content: `Error reading file: ${(error as Error).message}`,
            path: entryRelativePath
          });
        }
      }
      // Ignore other types of entries (symlinks, etc.)
    }

    // Return the folder with its items
    return {
      folderName,
      path: relativePath,
      items
    };
  } catch (error) {
    throw new Error(`Error processing directory '${folderPath}': ${(error as Error).message}`);
  }
}

/**
 * Saves the template structure to a JSON file
 * 
 * @param templatePath - Path to the template directory
 * @param outputPath - Path where the JSON file should be saved
 * @param options - Scanning options
 * @returns Promise resolving when the file has been written
 */
export async function saveTemplateStructureToJson(
  templatePath: string, 
  outputPath: string,
  options?: ScanOptions
): Promise<void> {
  try {
    // Scan the template directory
    const templateStructure = await scanTemplateDirectory(templatePath, options);
    
    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.promises.mkdir(outputDir, { recursive: true });
    
    // Write the JSON file
    const data = await fs.promises.writeFile(
      outputPath, 
      JSON.stringify(templateStructure, null, 2),
      'utf8'
    );
    console.log(`Template structure saved to ${outputPath}`);


    
  } catch (error) {
    throw new Error(`Error saving template structure: ${(error as Error).message}`);
  }
}

export async function readTemplateStructureFromJson(filePath: string): Promise<TemplateFolder> {
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(data) as TemplateFolder;
  } catch (error) {
    throw new Error(`Error reading template structure: ${(error as Error).message}`);
  }
}

/**
 * Example usage:
 * 
 * // Basic usage with default options
 * const templateStructure = await scanTemplateDirectory('./templates/react-app');
 * 
 * // With custom options
 * const customOptions = {
 *   ignoreFiles: ['README.md', 'CHANGELOG.md'],
 *   ignoreFolders: ['docs', 'examples'],
 *   maxFileSize: 500 * 1024 // 500KB
 * };
 * const templateStructure = await scanTemplateDirectory('./templates/react-app', customOptions);
 * 
 * // Saving directly to a JSON file with custom options
 * await saveTemplateStructureToJson(
 *   './templates/react-app', 
 *   './output/react-app-template.json',
 *   customOptions
 * );
 */
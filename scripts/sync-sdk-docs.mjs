#!/usr/bin/env node
import { mkdir, readdir, rm, stat, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSource = path.resolve(repoRoot, '..', 'fluxzero-sdk-java', 'docs', 'developer');
const sourceDir = path.resolve(repoRoot, process.env.FLUXZERO_SDK_DOCS_SOURCE ?? defaultSource);
const targetDir = path.join(repoRoot, 'src', 'content', 'docs', 'docs');

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function copyDirectory(source, target) {
  await mkdir(target, { recursive: true });
  let mdxCount = 0;
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === '.git') {
      continue;
    }
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      mdxCount += await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
      if (entry.name.endsWith('.mdx')) {
        mdxCount += 1;
      }
    }
  }
  return mdxCount;
}

if (!(await pathExists(sourceDir))) {
  console.error(
    'Fluxzero SDK docs not found at ' + sourceDir + '. ' +
      'Set FLUXZERO_SDK_DOCS_SOURCE or check out fluxzero-sdk-java next to this repo.',
  );
  process.exit(1);
}

await rm(targetDir, { recursive: true, force: true });
const mdxCount = await copyDirectory(sourceDir, targetDir);

if (mdxCount === 0) {
  console.error('No MDX docs found in ' + sourceDir + '.');
  process.exit(1);
}

console.log('Synced ' + mdxCount + ' SDK docs pages from ' + sourceDir + ' to ' + targetDir + '.');

import type { Loader } from 'astro/loaders';
import { z } from 'astro:content';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const GITHUB_API_BASE = 'https://api.github.com';
const REPO = 'flux-capacitor-io/flux-capacitor-client';
const CACHE_FILE = join(process.cwd(), 'src', 'data', 'changelog-cache.json');

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

interface ChangelogRelease {
  version: string;
  date: string;
  body: string;
  url: string;
  quarterKey: string;
  year: number;
  quarter: string;
}

interface ChangelogCache {
  lastUpdated: string;
  latestVersion: string;
  releases: ChangelogRelease[];
}

const changelogReleaseSchema = z.object({
  version: z.string(),
  date: z.string(),
  body: z.string(),
  url: z.string(),
  quarterKey: z.string(),
  year: z.number(),
  quarter: z.string(),
});

export function changelogLoader(): Loader {
  return {
    name: 'changelog-loader',
    async load({ store, logger, parseData }) {
      logger.info("Loading changelog releases");
      
      try {
        // Clear existing store
        store.clear();
        
        // Read cached data if it exists
        const cachedData = await readCacheFile();
        let allReleases = cachedData.releases;
        
        if (cachedData.releases.length > 0) {
          logger.info(`Found ${cachedData.releases.length} cached releases (latest: ${cachedData.latestVersion})`);
          
          // Fetch only new releases since the cached version
          const newGitHubReleases = await fetchReleases(cachedData.latestVersion);
          
          if (newGitHubReleases.length > 0) {
            logger.info(`Found ${newGitHubReleases.length} new releases`);
            
            // Process new releases
            const newReleases = newGitHubReleases.map(formatChangelogRelease);
            
            // Add new releases to the beginning (most recent first)
            allReleases = [...newReleases, ...allReleases];
            
            // Update cache file
            await writeCacheFile({
              lastUpdated: new Date().toISOString(),
              latestVersion: newReleases[0].version,
              releases: allReleases
            });
            
            logger.info(`Updated cache with ${newReleases.length} new releases`);
          } else {
            logger.info("No new releases found, using cached data");
          }
        } else {
          logger.info("No cached data found, fetching all releases");
          
          // Fetch all releases
          const gitHubReleases = await fetchReleases();
          allReleases = gitHubReleases.map(formatChangelogRelease);
          
          // Create initial cache file
          await writeCacheFile({
            lastUpdated: new Date().toISOString(),
            latestVersion: allReleases[0]?.version || '',
            releases: allReleases
          });
          
          logger.info(`Cached ${allReleases.length} releases`);
        }
        
        // Add all releases to the store
        for (const release of allReleases) {
          const data = await parseData({
            id: release.version,
            data: release
          });
          
          store.set({
            id: data.version,
            data
          });
        }
        
        logger.info(`Loaded ${allReleases.length} changelog releases`);
        
      } catch (error) {
        logger.error(`Failed to load changelog: ${error}`);
        throw error;
      }
    }
  };
}

function parseVersion(tag: string): number[] {
  const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function compareVersions(a: string, b: string): number {
  const versionA = parseVersion(a);
  const versionB = parseVersion(b);
  
  for (let i = 0; i < 3; i++) {
    if (versionA[i] !== versionB[i]) {
      return versionA[i] - versionB[i];
    }
  }
  return 0;
}

function getQuarterKey(date: string): { year: number; quarter: string; quarterNum: number } {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const quarterNum = Math.floor(month / 3) + 1;
  const quarter = `Q${quarterNum}`;
  
  return { year, quarter, quarterNum };
}

async function fetchReleases(sinceVersion?: string): Promise<GitHubRelease[]> {
  const releases: GitHubRelease[] = [];
  let page = 1;
  const perPage = 100;
  
  // Prepare headers with GitHub token if available
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'flux-docs-changelog-loader'
  };
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    console.log('Using GitHub token for API requests');
  } else {
    console.warn('No GITHUB_TOKEN found, using unauthenticated requests (rate limited)');
  }
  
  while (page <= 20) { // GitHub API has a limit
    const url = `${GITHUB_API_BASE}/repos/${REPO}/releases?per_page=${perPage}&page=${page}`;
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      if (response.status === 422 && page > 10) {
        // GitHub API pagination limit reached
        break;
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    const pageReleases: GitHubRelease[] = await response.json();
    
    if (pageReleases.length === 0) break;
    
    let foundCutoff = false;
    for (const release of pageReleases) {
      const cleanVersion = release.tag_name.replace(/^v/, '');
      
      // Stop if we've reached a version we already have cached
      if (sinceVersion && compareVersions(sinceVersion, cleanVersion) >= 0) {
        foundCutoff = true;
        break;
      }
      
      // Skip versions before 0.1192.0
      if (compareVersions(cleanVersion, '0.1192.0') < 0) {
        foundCutoff = true;
        break;
      }
      
      // Skip releases with no meaningful content
      if (!release.body || release.body.trim().length === 0 || 
          release.body.trim() === release.name || 
          release.body.trim() === `Flux Capacitor ${cleanVersion}`) {
        continue;
      }
      
      releases.push(release);
    }
    
    if (foundCutoff) break;
    
    page++;
    
    // Respect rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return releases;
}

function formatChangelogRelease(release: GitHubRelease): ChangelogRelease {
  const version = release.tag_name.replace(/^v/, '');
  const dateMatch = release.published_at.match(/^(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : release.published_at;
  
  // Get quarter information
  const { year, quarter } = getQuarterKey(date);
  const quarterKey = `${year}-${quarter}`;
  
  // Format the body content
  let body = release.body;
  
  // Increase all heading levels by 2 (h2->h4, h3->h5, etc.)
  body = body.replace(/^(#+)/gm, (match, hashes) => {
    return hashes + '##';
  });
  
  // Remove any existing version heading
  body = body.replace(/^#+\s*\[?[\d.]+\]?\s*\([\d-]+\)\s*\n/m, '');
  
  // Ensure all headings are at least h4
  body = body.replace(/^(#{1,3})\s/gm, '#### ');
  
  return {
    version,
    date,
    body: body.trim(),
    url: release.html_url,
    quarterKey,
    year,
    quarter,
  };
}

async function readCacheFile(): Promise<ChangelogCache> {
  try {
    if (!existsSync(CACHE_FILE)) {
      return {
        lastUpdated: '',
        latestVersion: '',
        releases: []
      };
    }
    
    const content = readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('Failed to read cache file:', error);
    return {
      lastUpdated: '',
      latestVersion: '',
      releases: []
    };
  }
}

async function writeCacheFile(cache: ChangelogCache): Promise<void> {
  try {
    // Ensure the directory exists
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    
    // Write the cache file
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.warn('Failed to write cache file:', error);
  }
}
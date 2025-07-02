#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const GITHUB_API_BASE = 'https://api.github.com';
const REPO = 'flux-capacitor-io/flux-capacitor-client';
const CHANGELOG_PATH = join(process.cwd(), 'src/content/docs/reference/changelog.mdx');

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

interface ChangelogData {
  frontmatter: Record<string, any>;
  releasesByQuarter: Map<string, {
    releases: string[];
    minVersion: string;
    maxVersion: string;
  }>;
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
  
  console.log(`Fetching releases from GitHub${sinceVersion ? ` since ${sinceVersion}` : ''}...`);
  
  while (page <= 20) { // GitHub API has a limit, typically around 10-20 pages
    const url = `${GITHUB_API_BASE}/repos/${REPO}/releases?per_page=${perPage}&page=${page}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 422 && page > 10) {
        // GitHub API pagination limit reached
        console.log(`  Reached GitHub API pagination limit at page ${page}`);
        break;
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    const pageReleases: GitHubRelease[] = await response.json();
    
    if (pageReleases.length === 0) break;
    
    let foundExisting = false;
    for (const release of pageReleases) {
      const cleanVersion = release.tag_name.replace(/^v/, '');
      if (sinceVersion && compareVersions(sinceVersion, cleanVersion) >= 0) {
        foundExisting = true;
        break;
      }
      
      // Skip releases with no meaningful content
      if (!release.body || release.body.trim().length === 0 || 
          release.body.trim() === release.name || 
          release.body.trim() === `Flux Capacitor ${cleanVersion}`) {
        console.log(`  Skipping release ${cleanVersion} (no content)`);
        continue;
      }
      
      // Skip versions before 0.1192.0
      if (compareVersions(cleanVersion, '0.1192.0') < 0) {
        console.log(`  Reached version cutoff at ${cleanVersion} (before 0.1192.0)`);
        foundExisting = true;
        break;
      }
      
      releases.push(release);
    }
    
    if (foundExisting) break;
    
    console.log(`  Fetched page ${page} (${pageReleases.length} releases)`);
    page++;
    
    // Respect rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`Found ${releases.length} new releases`);
  return releases;
}

function parseChangelog(content: string): ChangelogData {
  const lines = content.split('\n');
  const frontmatterEnd = lines.findIndex((line, idx) => idx > 0 && line.trim() === '---');
  
  if (frontmatterEnd === -1) {
    throw new Error('Invalid changelog format: no frontmatter found');
  }
  
  // Parse frontmatter
  const frontmatter: Record<string, any> = {};
  let currentKey: string | null = null;
  
  for (let i = 1; i < frontmatterEnd; i++) {
    const line = lines[i];
    
    // Check for nested object (key with no value, followed by indented lines)
    const keyOnlyMatch = line.match(/^(\w+):\s*$/);
    if (keyOnlyMatch) {
      currentKey = keyOnlyMatch[1];
      frontmatter[currentKey] = {};
      continue;
    }
    
    // Check for indented line (part of nested object)
    const indentedMatch = line.match(/^\s+(\w+):\s*(.+)$/);
    if (indentedMatch && currentKey) {
      frontmatter[currentKey][indentedMatch[1]] = indentedMatch[2].trim();
      continue;
    }
    
    // Regular key-value pair
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      frontmatter[match[1]] = match[2].trim();
      currentKey = null;
    }
  }
  
  // Parse quarterly structure
  const releasesByQuarter = new Map<string, {
    releases: string[];
    minVersion: string;
    maxVersion: string;
  }>();
  
  const contentStart = frontmatterEnd + 1;
  let currentYear = '';
  let currentQuarter = '';
  let inQuarterDetails = false;
  let currentReleases: string[] = [];
  let minVersion = '';
  let maxVersion = '';
  
  for (let i = contentStart; i < lines.length; i++) {
    const line = lines[i];
    
    // Year heading
    if (line.match(/^##\s+\d{4}$/)) {
      currentYear = line.match(/\d{4}/)![0];
    }
    // Quarter heading: YYYY-QX - release MIN - MAX
    else if (line.match(/^###\s+\d{4}-Q\d/)) {
      // Save previous quarter if exists
      if (currentYear && currentQuarter && currentReleases.length > 0) {
        releasesByQuarter.set(`${currentYear}-${currentQuarter}`, {
          releases: currentReleases,
          minVersion,
          maxVersion
        });
      }
      
      // Extract quarter info and version range: YYYY-QX - release MIN - MAX
      const quarterMatch = line.match(/^###\s+(\d{4})-Q(\d)(?:\s+-\s+release\s+(.+))?/);
      if (quarterMatch) {
        currentYear = quarterMatch[1];
        currentQuarter = `Q${quarterMatch[2]}`;
        currentReleases = [];
        minVersion = '';
        maxVersion = '';
        
        // Extract version range if present
        const versionRange = quarterMatch[3];
        if (versionRange && versionRange.includes(' - ')) {
          const [min, max] = versionRange.split(' - ');
          minVersion = min.trim();
          maxVersion = max.trim();
        } else if (versionRange) {
          minVersion = maxVersion = versionRange.trim();
        }
      }
    }
    // Details block for releases
    else if (line.includes('<details>') && line.includes('<summary>')) {
      // Extract version from summary
      const versionMatch = line.match(/<summary>([^<]+)<\/summary>/);
      if (versionMatch) {
        let detailsContent = line + '\n';
        i++;
        
        // Read until closing details
        while (i < lines.length && !lines[i].includes('</details>')) {
          detailsContent += lines[i] + '\n';
          i++;
        }
        if (i < lines.length) {
          detailsContent += lines[i]; // Add closing </details>
        }
        
        currentReleases.push(detailsContent.trim());
      }
    }
  }
  
  // Save the last quarter
  if (currentYear && currentQuarter && currentReleases.length > 0) {
    releasesByQuarter.set(`${currentYear}-${currentQuarter}`, {
      releases: currentReleases,
      minVersion,
      maxVersion
    });
  }
  
  return { frontmatter, releasesByQuarter };
}

function formatRelease(release: GitHubRelease): string {
  // GitHub body already contains the formatted markdown
  let body = release.body;
  
  // Increase all heading levels by 2 (h2->h4, h3->h5, etc.) to make room for year/quarter headings
  body = body.replace(/^(#+)/gm, (match, hashes) => {
    return hashes + '##';
  });
  
  // Remove any existing version heading as we'll add it in the details summary
  body = body.replace(/^#+\s*\[?[\d.]+\]?\s*\([\d-]+\)\s*\n/m, '');
  
  // Ensure all headings are at least h4
  body = body.replace(/^(#{1,3})\s/gm, '#### ');
  
  const version = release.tag_name.replace(/^v/, '');
  const dateMatch = release.published_at.match(/^(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : release.published_at;
  
  // Wrap in details with version as summary
  return `<details>
<summary>${version} (${date})</summary>

${body.trim()}

</details>`;
}

function generateChangelog(data: ChangelogData): string {
  const parts: string[] = [];
  
  // Frontmatter
  parts.push('---');
  for (const [key, value] of Object.entries(data.frontmatter)) {
    if (typeof value === 'object' && value !== null) {
      parts.push(`${key}:`);
      for (const [subKey, subValue] of Object.entries(value)) {
        parts.push(`  ${subKey}: ${subValue}`);
      }
    } else {
      parts.push(`${key}: ${value}`);
    }
  }
  parts.push('---');
  parts.push('');
  
  // Group by year
  const yearMap = new Map<number, Map<string, {
    releases: string[];
    minVersion: string;
    maxVersion: string;
  }>>();
  
  for (const [key, quarterData] of data.releasesByQuarter) {
    const year = parseInt(key.split('-')[0]);
    if (!yearMap.has(year)) {
      yearMap.set(year, new Map());
    }
    const quarter = key.substring(5); // Remove year prefix
    yearMap.get(year)!.set(quarter, quarterData);
  }
  
  // Sort years descending
  const years = Array.from(yearMap.keys()).sort((a, b) => b - a);
  
  for (const year of years) {
    parts.push(`## ${year}`);
    parts.push('');
    
    const quarters = yearMap.get(year)!;
    const sortedQuarters = Array.from(quarters.entries()).sort((a, b) => {
      // Extract quarter number for sorting
      const qNumA = parseInt(a[0].match(/Q(\d)/)![1]);
      const qNumB = parseInt(b[0].match(/Q(\d)/)![1]);
      return qNumB - qNumA;
    });
    
    for (const [quarter, quarterData] of sortedQuarters) {
      const { releases, minVersion, maxVersion } = quarterData;
      
      // Format quarter heading: YYYY-QX - release MIN - MAX
      let quarterHeader = `${year}-${quarter}`;
      if (minVersion && maxVersion) {
        quarterHeader += minVersion === maxVersion 
          ? ` - release ${minVersion}`
          : ` - release ${minVersion} - ${maxVersion}`;
      }
      
      parts.push(`### ${quarterHeader}`);
      parts.push('');
      
      for (const release of releases) {
        parts.push(release);
        parts.push('');
      }
    }
    
    parts.push('');
  }
  
  return parts.join('\n');
}

async function updateChangelog(fullRebuild = false) {
  try {
    let changelogData: ChangelogData;
    
    if (fullRebuild) {
      console.log('🔄 Running full rebuild mode...');
      // Start fresh for full rebuild
      changelogData = {
        frontmatter: {
          title: 'Changelog',
          description: 'Complete release history for flux-capacitor-client',
          sidebar: {
            order: 45
          },
          updatedUntil: '0.0.0'
        },
        releasesByQuarter: new Map()
      };
    } else {
      // Read existing changelog for incremental update
      const existingContent = readFileSync(CHANGELOG_PATH, 'utf-8');
      changelogData = parseChangelog(existingContent);
    }
    
    // Fetch releases
    const sinceVersion = fullRebuild ? undefined : changelogData.frontmatter.updatedUntil;
    const releases = await fetchReleases(sinceVersion);
    
    if (releases.length === 0 && !fullRebuild) {
      console.log('No new releases found. Changelog is up to date.');
      return;
    }
    
    console.log(`Processing ${releases.length} releases...`);
    
    for (const release of releases) {
      const formattedRelease = formatRelease(release);
      const version = release.tag_name.replace(/^v/, '');
      
      // Group by quarter
      const dateMatch = release.published_at.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const { year, quarter } = getQuarterKey(dateMatch[1]);
        const key = `${year}-${quarter}`;
        
        if (!changelogData.releasesByQuarter.has(key)) {
          changelogData.releasesByQuarter.set(key, {
            releases: [],
            minVersion: version,
            maxVersion: version
          });
        }
        
        const quarterData = changelogData.releasesByQuarter.get(key)!;
        quarterData.releases.push(formattedRelease); // Add to end, will sort later
        
        // Update version range
        if (compareVersions(version, quarterData.maxVersion) > 0) {
          quarterData.maxVersion = version;
        }
        if (compareVersions(version, quarterData.minVersion) < 0) {
          quarterData.minVersion = version;
        }
      }
    }
    
    // Update frontmatter with latest version
    if (releases.length > 0) {
      changelogData.frontmatter.updatedUntil = releases[0].tag_name.replace(/^v/, '');
    }
    
    // Sort releases within each quarter (most recent first)
    for (const quarterData of changelogData.releasesByQuarter.values()) {
      quarterData.releases.sort((a, b) => {
        // Extract version from <summary>VERSION (DATE)</summary>
        const versionA = a.match(/<summary>([^(]+)\s*\(/)?.[1]?.trim() || '';
        const versionB = b.match(/<summary>([^(]+)\s*\(/)?.[1]?.trim() || '';
        return compareVersions(versionB, versionA); // Most recent first (B > A)
      });
    }
    
    // Generate new changelog
    const newContent = generateChangelog(changelogData);
    
    // Write back
    writeFileSync(CHANGELOG_PATH, newContent);
    console.log(`✅ Changelog updated successfully${fullRebuild ? ' (full rebuild)' : ''}`);
    
    const totalReleases = Array.from(changelogData.releasesByQuarter.values())
      .reduce((sum, quarter) => sum + quarter.releases.length, 0);
    console.log(`   Total releases: ${totalReleases}`);
    console.log(`   Updated until: ${changelogData.frontmatter.updatedUntil}`);
    
  } catch (error) {
    console.error('❌ Error updating changelog:', error);
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);
const fullRebuild = args.includes('--full');

if (fullRebuild) {
  console.log('Running in full rebuild mode...');
}

updateChangelog(fullRebuild);
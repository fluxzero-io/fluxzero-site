#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const GITHUB_API_BASE = 'https://api.github.com';
const REPO = 'flux-capacitor-io/flux-capacitor-client';
const CHANGELOG_PATH = join(process.cwd(), 'src/content/docs/reference/changelog.mdx');
const RECENT_RELEASES_COUNT = 30;

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

interface ChangelogData {
  frontmatter: Record<string, any>;
  recentReleases: string[];
  archiveByQuarter: Map<string, string[]>;
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
  const quarters = ['Q1 (January - March)', 'Q2 (April - June)', 'Q3 (July - September)', 'Q4 (October - December)'];
  
  return { year, quarter: quarters[quarterNum - 1], quarterNum };
}

async function fetchReleases(sinceVersion?: string): Promise<GitHubRelease[]> {
  const releases: GitHubRelease[] = [];
  let page = 1;
  const perPage = 100;
  
  console.log(`Fetching releases from GitHub${sinceVersion ? ` since ${sinceVersion}` : ''}...`);
  
  while (true) {
    const url = `${GITHUB_API_BASE}/repos/${REPO}/releases?per_page=${perPage}&page=${page}`;
    const response = await fetch(url);
    
    if (!response.ok) {
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
  for (let i = 1; i < frontmatterEnd; i++) {
    const line = lines[i];
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      frontmatter[match[1]] = match[2].trim();
    }
  }
  
  // Find sections
  const contentStart = frontmatterEnd + 1;
  let recentStart = -1;
  let archiveStart = -1;
  
  for (let i = contentStart; i < lines.length; i++) {
    if (lines[i].trim() === '## Recent Releases') {
      recentStart = i + 1;
    } else if (lines[i].trim() === '## Release Archive') {
      archiveStart = i + 1;
      break;
    }
  }
  
  // Extract recent releases
  const recentReleases: string[] = [];
  if (recentStart !== -1) {
    let currentRelease = '';
    const endIdx = archiveStart !== -1 ? archiveStart - 1 : lines.length;
    
    for (let i = recentStart; i < endIdx; i++) {
      const line = lines[i];
      if (line.match(/^##\s+\[?\d+\.\d+\.\d+/)) {
        if (currentRelease) {
          recentReleases.push(currentRelease.trim());
        }
        currentRelease = line + '\n';
      } else if (currentRelease) {
        currentRelease += line + '\n';
      }
    }
    if (currentRelease) {
      recentReleases.push(currentRelease.trim());
    }
  }
  
  // Parse archive structure
  const archiveByQuarter = new Map<string, string[]>();
  
  if (archiveStart !== -1) {
    let currentYear = '';
    let currentQuarter = '';
    let inDetails = false;
    let currentReleases: string[] = [];
    
    for (let i = archiveStart; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.match(/^###\s+\d{4}$/)) {
        currentYear = line.match(/\d{4}/)![0];
      } else if (line.includes('<details>')) {
        inDetails = true;
        const summaryMatch = lines[i + 1]?.match(/Q\d\s+\([^)]+\)/);
        if (summaryMatch) {
          currentQuarter = summaryMatch[0];
          currentReleases = [];
        }
      } else if (line.includes('</details>')) {
        if (currentYear && currentQuarter) {
          archiveByQuarter.set(`${currentYear}-${currentQuarter}`, currentReleases);
        }
        inDetails = false;
      } else if (inDetails && line.match(/^##/)) {
        // Start of a release in archive
        let releaseContent = line + '\n';
        i++;
        while (i < lines.length && !lines[i].match(/^##/) && !lines[i].includes('</details>')) {
          releaseContent += lines[i] + '\n';
          i++;
        }
        i--; // Back up one line
        currentReleases.push(releaseContent.trim());
      }
    }
  }
  
  return { frontmatter, recentReleases, archiveByQuarter };
}

function formatRelease(release: GitHubRelease): string {
  // GitHub body already contains the formatted markdown
  // Just need to ensure proper heading level
  let body = release.body;
  
  // Ensure the main version heading is at level 2
  const versionMatch = body.match(/^#+\s*\[?(\d+\.\d+\.\d+)/m);
  if (versionMatch) {
    const version = release.tag_name.replace(/^v/, '');
    const dateMatch = release.published_at.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : release.published_at;
    
    // Replace the first line with our standardized format
    body = body.replace(/^.*\n/, `## ${version} (${date})\n`);
  }
  
  return body.trim();
}

function generateChangelog(data: ChangelogData): string {
  const parts: string[] = [];
  
  // Frontmatter
  parts.push('---');
  for (const [key, value] of Object.entries(data.frontmatter)) {
    parts.push(`${key}: ${value}`);
  }
  parts.push('---');
  parts.push('');
  
  // Recent releases
  parts.push('## Recent Releases');
  parts.push('');
  for (const release of data.recentReleases) {
    parts.push(release);
    parts.push('');
  }
  
  // Archive
  parts.push('## Release Archive');
  parts.push('');
  
  // Group by year
  const yearMap = new Map<number, Map<string, string[]>>();
  for (const [key, releases] of data.archiveByQuarter) {
    const year = parseInt(key.split('-')[0]);
    if (!yearMap.has(year)) {
      yearMap.set(year, new Map());
    }
    const quarter = key.substring(5); // Remove year prefix
    yearMap.get(year)!.set(quarter, releases);
  }
  
  // Sort years descending
  const years = Array.from(yearMap.keys()).sort((a, b) => b - a);
  
  for (const year of years) {
    parts.push(`### ${year}`);
    parts.push('');
    
    const quarters = yearMap.get(year)!;
    const sortedQuarters = Array.from(quarters.entries()).sort((a, b) => {
      // Extract quarter number for sorting
      const qNumA = parseInt(a[0].match(/Q(\d)/)![1]);
      const qNumB = parseInt(b[0].match(/Q(\d)/)![1]);
      return qNumB - qNumA;
    });
    
    for (const [quarter, releases] of sortedQuarters) {
      parts.push('<details>');
      parts.push(`<summary>${quarter} - ${releases.length} releases</summary>`);
      parts.push('');
      
      for (const release of releases) {
        parts.push(release);
        parts.push('');
      }
      
      parts.push('</details>');
      parts.push('');
    }
  }
  
  return parts.join('\n');
}

async function updateChangelog(fullRebuild = false) {
  try {
    // Read existing changelog
    const existingContent = readFileSync(CHANGELOG_PATH, 'utf-8');
    const changelogData = parseChangelog(existingContent);
    
    // Fetch new releases
    const sinceVersion = fullRebuild ? undefined : changelogData.frontmatter.updatedUntil;
    const newReleases = await fetchReleases(sinceVersion);
    
    if (newReleases.length === 0 && !fullRebuild) {
      console.log('No new releases found. Changelog is up to date.');
      return;
    }
    
    // Add new releases to recent section
    const formattedNewReleases = newReleases.map(formatRelease);
    changelogData.recentReleases.unshift(...formattedNewReleases);
    
    // Move old releases to archive if we exceed the limit
    while (changelogData.recentReleases.length > RECENT_RELEASES_COUNT) {
      const oldRelease = changelogData.recentReleases.pop()!;
      
      // Extract date from release
      const dateMatch = oldRelease.match(/##\s+\d+\.\d+\.\d+\s+\((\d{4}-\d{2}-\d{2})\)/);
      if (dateMatch) {
        const { year, quarter } = getQuarterKey(dateMatch[1]);
        const key = `${year}-${quarter}`;
        
        if (!changelogData.archiveByQuarter.has(key)) {
          changelogData.archiveByQuarter.set(key, []);
        }
        changelogData.archiveByQuarter.get(key)!.unshift(oldRelease);
      }
    }
    
    // Update frontmatter
    if (newReleases.length > 0) {
      changelogData.frontmatter.updatedUntil = newReleases[0].tag_name.replace(/^v/, '');
    }
    
    // Generate new changelog
    const newContent = generateChangelog(changelogData);
    
    // Write back
    writeFileSync(CHANGELOG_PATH, newContent);
    console.log(`✅ Changelog updated successfully with ${newReleases.length} new releases`);
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
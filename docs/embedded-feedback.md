# GitHub-Integrated Documentation Feedback System

## Overview
A system that allows documentation visitors to select text passages and provide feedback or ask questions directly within the documentation, using GitHub Issues or Discussions as the backend.

## Suggested Features

### 1. Text Selection & Annotation
- **Select any passage**: Users can highlight any text in the documentation
- **Inline feedback**: Add comments or questions directly on selected text
- **Visual indicators**: Show which passages have existing feedback/discussions
- **Thread-based discussions**: Each selection can have its own discussion thread
- **Contextual preview**: Show feedback count and preview on hover

### 2. GitHub Integration Options

#### Option A: GitHub Discussions (Recommended)
- Better suited for Q&A and community discussions
- Supports threaded conversations
- Built-in upvoting and reactions
- Categories for organization (e.g., "Documentation Feedback", "Questions", "Suggestions")

#### Option B: GitHub Issues
- Better for tracking actionable documentation improvements
- Integrates with project boards and milestones
- Clear resolution status
- Assignable to team members

#### Option C: Hybrid Approach
- Questions and discussions → GitHub Discussions
- Bug reports and improvements → GitHub Issues
- User selects feedback type when submitting

### 3. User Experience Features
- **Two-tier access**:
  - **Anonymous visitors**: Can view all feedback without login
  - **GitHub users**: Can submit feedback and comment after OAuth login
- **GitHub Single Sign-On**: Simple authentication for contributors
- **User profiles**: Display avatars and contribution history
- **Voting system**: Upvote helpful feedback (requires login)
- **Filtering options**:
  - Status: Open/Resolved/All
  - Popularity: Most upvoted/discussed
  - Recency: Latest feedback first
  - Page: Current page only or all docs
- **Notifications**: GitHub notifications for responses (for logged-in users)
- **Rich text**: Markdown support in feedback submissions
- **Code snippets**: Ability to include code examples
- **Mobile responsive**: Works on all devices

### 4. Documentation Team Features
- **Feedback dashboard**: Overview of all feedback across documentation
- **Heat map**: Visual representation of most-discussed sections
- **Analytics**:
  - Most confusing sections
  - Trending questions
  - Resolution time metrics
  - User engagement stats
- **Auto-labeling**: Automatic labels based on:
  - Documentation section
  - Feedback type
  - Priority indicators
- **Assignment system**: Route feedback to appropriate maintainers
- **Resolution tracking**: Mark feedback as resolved/implemented
- **Changelog integration**: Link feedback to documentation updates

## Implementation Approach

### Phase 1: Core Infrastructure (Week 1-2)

#### 1.1 Authentication Setup
**Two-tier authentication approach:**

**A. Public Read Access (No login required)**
- Server-side GitHub Personal Access Token (PAT) or App token
- Read-only access to public discussions/issues
- Used for displaying existing feedback to all visitors
- Token stored in environment variables, never exposed to client

**B. User Write Access (GitHub OAuth required)**
- GitHub OAuth flow for users who want to submit feedback
- Creates issues/discussions on behalf of the authenticated user
- User's GitHub identity visible on their submissions
- Optional: Users can edit/delete their own feedback

#### 1.2 Backend API
- **Public endpoints** (no auth required):
  - `src/pages/api/feedback/list.ts` - List feedback for a page (uses server token)
  - `src/pages/api/feedback/[id].ts` - Get specific feedback thread (uses server token)

- **Authenticated endpoints** (require user OAuth):
  - `src/pages/api/auth/github/login.ts` - GitHub OAuth initiation
  - `src/pages/api/auth/github/callback.ts` - OAuth callback handler
  - `src/pages/api/auth/github/logout.ts` - Session termination
  - `src/pages/api/auth/github/user.ts` - Get current user info
  - `src/pages/api/feedback/create.ts` - Create new feedback (uses user token)
  - `src/pages/api/feedback/[id]/comment.ts` - Add comment (uses user token)

#### 1.3 Data Storage Strategy
- **All feedback data stored in GitHub**:
  - Selection metadata embedded in Discussion/Issue body as HTML comments
  - No separate database required
  - GitHub is the single source of truth

- **Browser-based session storage**:
  - JWT tokens in httpOnly cookies
  - User info cached in sessionStorage
  - No server-side session state needed

- **Optional Cloudflare KV** (for performance only):
  - `github_api_cache` - Cache GitHub API responses
  - Short TTL (5-15 minutes)
  - Reduces API calls and improves response times

### Phase 2: Selection & Annotation UI (Week 2-3)

#### 2.1 Text Selection Detection
The selection system uses the browser's native Selection API to detect when users highlight text:

```typescript
// src/components/TextSelector.tsx
interface Selection {
  text: string;                // The selected text
  startOffset: number;          // Character position where selection starts
  endOffset: number;            // Character position where selection ends
  containerPath: string;        // CSS selector to identify the container
  parentHeading: string;        // Nearest h1/h2/h3 for context
  pageUrl: string;              // Current documentation page
}

// Listen for text selection
document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  if (selection.toString().trim().length > 10) {
    // Show feedback button near selection
    showFeedbackButton(selection);
  }
});

// Get precise selection location
function getSelectionPath(selection: Selection): string {
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  // Generate unique CSS selector path
  return generateCSSPath(container);
}
```

#### 2.2 Feedback Widget Implementation
The widget appears as a floating button when text is selected, then expands to a form:

```typescript
// src/components/FeedbackWidget.tsx
function FeedbackWidget({ selection, existingFeedback }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Position the widget near the selection
  const position = calculatePosition(selection);

  return (
    <div className="feedback-widget" style={position}>
      {!isExpanded ? (
        <button onClick={() => setIsExpanded(true)}>
          💬 Add Feedback ({existingFeedback.length})
        </button>
      ) : (
        <FeedbackForm selection={selection} />
      )}
    </div>
  );
}

// Smart positioning to avoid viewport edges
function calculatePosition(selection) {
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  return {
    top: rect.bottom + 10,
    left: Math.max(10, Math.min(rect.left, window.innerWidth - 300))
  };
}
```

#### 2.3 Preserving Selection Context
To link feedback to specific text even if the page content changes:

```typescript
// Store selection with multiple anchoring strategies
interface SelectionAnchor {
  // Method 1: Character offsets within parent element
  textOffset: {
    start: number;
    end: number;
    parentId?: string;  // If parent has an ID
  };

  // Method 2: Surrounding context
  context: {
    prefix: string;     // 20 chars before selection
    suffix: string;     // 20 chars after selection
    exact: string;      // The selected text
  };

  // Method 3: Structural location
  structure: {
    heading: string;    // Nearest heading text
    paragraph: number;  // Paragraph index under heading
    sentence: number;   // Sentence index in paragraph
  };
}
```

#### 2.4 Visual Feedback Indicators
Show existing feedback inline without cluttering the reading experience:

```typescript
// src/components/FeedbackIndicator.tsx
function highlightFeedbackSections() {
  const feedbackData = await fetchFeedbackForPage();

  feedbackData.forEach(feedback => {
    const element = locateTextInDocument(feedback.selection);
    if (element) {
      // Wrap text in span with feedback indicator
      const wrapper = document.createElement('span');
      wrapper.className = 'has-feedback';
      wrapper.dataset.feedbackCount = feedback.comments.length;
      wrapper.dataset.feedbackId = feedback.githubId;

      // Add hover preview
      wrapper.addEventListener('mouseenter', showFeedbackPreview);

      // Wrap the original text
      element.replaceWith(wrapper);
      wrapper.appendChild(element);
    }
  });
}

// CSS for subtle visual indication
.has-feedback {
  background: linear-gradient(90deg, transparent 0%, #fef3c7 10%, #fef3c7 90%, transparent 100%);
  border-bottom: 1px dashed #f59e0b;
  cursor: help;
  position: relative;
}

.has-feedback::after {
  content: attr(data-feedback-count);
  position: absolute;
  top: -8px;
  right: -8px;
  background: #3b82f6;
  color: white;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 10px;
}
```

#### 2.5 Mobile-Friendly Selection
Handle touch devices differently:

```typescript
// Touch device detection and handling
let touchTimer;
document.addEventListener('touchstart', (e) => {
  touchTimer = setTimeout(() => {
    // Long press triggers selection mode
    enableSelectionMode();
  }, 500);
});

document.addEventListener('touchend', () => {
  clearTimeout(touchTimer);

  const selection = window.getSelection();
  if (selection.toString()) {
    // Show larger, touch-friendly feedback button
    showMobileFeedbackButton(selection);
  }
});
```

#### 2.6 Integration with Astro/Starlight
Since Starlight renders markdown content, we need to wait for the page to load:

```astro
---
// src/layouts/DocsLayout.astro
---
<script>
  // Initialize feedback system after content loads
  document.addEventListener('DOMContentLoaded', () => {
    import('../components/FeedbackSystem').then(({ init }) => {
      init({
        githubRepo: 'fluxzero-io/fluxzero-docs',
        githubDiscussionCategory: 'Documentation Feedback',
        enableSelectionMode: true,
        minSelectionLength: 10,
        maxSelectionLength: 500
      });
    });
  });
</script>
```

### Phase 3: GitHub Integration (Week 3-4)

#### 3.1 API Integration
- GitHub GraphQL for efficient queries
- REST API fallback for specific operations
- Rate limiting handling
- Error recovery
- All feedback data lives in GitHub (no local storage needed)

#### 3.2 Data Synchronization Strategy
- **Title Convention**: All feedback discussions include `[slug:page-slug]` in title
  - Example: `[slug:getting-started/introduction] Question about installation`
  - Enables efficient filtering using GitHub's search API
  - No need to parse body content for page matching

- **Discussion Format**:
  ```markdown
  Title: [slug:getting-started/introduction] User's feedback title

  ## Documentation Feedback

  **Page**: [Introduction](/docs/getting-started/introduction)
  **Section**: Selected text appears here

  ### User Feedback
  [User's feedback content]

  ---
  *This feedback was submitted through the documentation site*

  <!-- Hidden metadata in HTML comment -->
  ```

- **Efficient Retrieval**:
  - Use GitHub Search API with `"[slug:page-slug]" in:title`
  - Much faster than fetching all discussions and filtering
  - Reduces API calls and processing time
  - Cache responses in KV for performance (optional)

#### 3.3 Webhook Handlers
- `src/pages/api/webhooks/github.ts` - Process GitHub events
- Update local cache on changes
- Notify users of responses

### Phase 4: Enhancements (Week 4-5)

#### 4.1 Performance
- Implement caching strategy
- Lazy load feedback data
- Optimize API calls with batching
- Add request debouncing

#### 4.2 Analytics Dashboard
- Create admin interface at `/admin/feedback`
- Metrics visualization
- Export capabilities
- Bulk operations

#### 4.3 Advanced Features
- AI-powered categorization
- Duplicate detection
- Auto-suggest similar questions
- Integration with documentation search

## Technical Implementation Details

### Frontend Components

```typescript
// src/components/FeedbackWidget.tsx
interface FeedbackWidgetProps {
  selection: Selection;
  onSubmit: (feedback: Feedback) => Promise<void>;
  existingFeedback?: FeedbackThread[];
}

// src/components/FeedbackIndicator.tsx
interface IndicatorProps {
  feedbackCount: number;
  feedbackType: 'question' | 'issue' | 'suggestion';
  onClick: () => void;
}
```

### API Endpoints

```typescript
// PUBLIC ENDPOINTS (use server token)
// src/pages/api/feedback/list.ts
GET /api/feedback/list?page=/docs/getting-started/introduction
// Returns: Array of feedback items with comments

// src/pages/api/feedback/[id].ts
GET /api/feedback/:id
// Returns: Single feedback thread with all comments

// AUTHENTICATED ENDPOINTS (use user's OAuth token)
// src/pages/api/feedback/create.ts
POST /api/feedback/create
Authorization: Bearer <user-jwt-token>
{
  type: 'discussion' | 'issue',
  title: string,
  body: string,
  pageUrl: string,
  selectedText: string
}

// src/pages/api/feedback/[id]/comment.ts
POST /api/feedback/:id/comment
Authorization: Bearer <user-jwt-token>
{
  body: string
}
```

### Configuration

```toml
# wrangler.toml additions
[[kv_namespaces]]
binding = "GITHUB_API_CACHE"
id = "github-cache-kv-id"
# Optional: Only for caching GitHub API responses

[vars]
GITHUB_APP_ID = "your-app-id"
GITHUB_CLIENT_ID = "your-client-id"
JWT_SECRET = "your-jwt-secret"  # For signing session tokens
```

### Environment Variables

```env
# For reading feedback (server-side only)
GITHUB_SERVER_TOKEN=ghp_xxxxx  # PAT with read access to discussions/issues

# For user authentication (OAuth)
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# For session management
JWT_SECRET=your-jwt-secret
```

## Security Considerations

1. **Authentication**
   - Secure OAuth flow with state parameter
   - PKCE for additional security
   - Session timeout after inactivity

2. **Authorization**
   - Rate limiting per user
   - CAPTCHA for anonymous users
   - Moderation queue for first-time contributors

3. **Data Protection**
   - Sanitize all user input
   - XSS prevention
   - CSRF protection
   - Content Security Policy headers

4. **Privacy**
   - GDPR compliance
   - User data deletion options
   - Clear privacy policy

## Migration Path

### Step 1: MVP Launch
- Basic text selection and GitHub Issues integration
- Manual moderation
- Limited to authenticated users

### Step 2: Beta
- Add GitHub Discussions support
- Implement caching
- Open to all visitors

### Step 3: Full Release
- Complete analytics dashboard
- AI-powered features
- Integration with documentation workflow

## Success Metrics

- **Engagement**: Number of feedback submissions per week
- **Quality**: Ratio of actionable feedback to total submissions
- **Resolution Time**: Average time to address feedback
- **User Satisfaction**: Feedback on the feedback system
- **Documentation Quality**: Reduction in support tickets

## Alternative Approaches Considered

1. **Third-party services** (Disqus, Utterances)
   - Pros: Quick setup, maintained
   - Cons: Less control, privacy concerns

2. **Custom backend**
   - Pros: Full control
   - Cons: Maintenance burden, hosting costs

3. **Static feedback** (Google Forms)
   - Pros: Simple, no maintenance
   - Cons: Poor UX, no context

## Technical Challenges & Solutions

### Challenge 1: Text Anchoring
**Problem**: Page content changes over time, breaking links to specific text selections.

**Solution**: Store multiple anchoring strategies in the GitHub Discussion/Issue body:
- The metadata is embedded as an HTML comment (invisible to users)
- Contains surrounding context (prefix/suffix) for fuzzy matching
- Tracks structural position (heading → paragraph → sentence)
- Character offsets for precise positioning
- When retrieving, try each strategy in order until match found
- Display "content may have changed" warning when uncertain

### Challenge 2: Performance with Many Feedback Items
**Problem**: Pages with lots of feedback could slow down loading.

**Solution**:
- Lazy load feedback data after page renders
- Use virtual scrolling for feedback lists
- Cache GitHub API responses aggressively
- Load feedback indicators first, full content on demand

### Challenge 3: Overlapping Selections
**Problem**: Multiple users might select overlapping text passages.

**Solution**:
- Merge overlapping selections into single feedback threads
- Show all related discussions in one place
- Use visual layers to indicate multiple feedback items

### Challenge 4: GitHub API Rate Limits
**Problem**: GitHub API has rate limits (5000/hour authenticated, 60/hour unauthenticated).

**Solution**:
- Cache responses in Cloudflare KV
- Batch API requests where possible
- Use conditional requests (ETags)
- Show cached data with refresh button

## Implementation Examples

### Example: Creating a GitHub Discussion from Selection

```typescript
// src/pages/api/feedback/create.ts
export async function POST({ request, locals }) {
  const { text, pageUrl, selectedText, title, body } = await request.json();
  const userToken = locals.user?.githubToken;

  if (!userToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Create discussion using GitHub GraphQL API
  const mutation = `
    mutation CreateDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
      createDiscussion(input: {
        repositoryId: $repositoryId,
        categoryId: $categoryId,
        title: $title,
        body: $body
      }) {
        discussion {
          id
          url
          number
        }
      }
    }
  `;

  // Extract page slug from URL (e.g., /docs/getting-started/introduction → getting-started/introduction)
  const pageSlug = new URL(pageUrl).pathname.replace('/docs/', '');

  // Include slug in title for efficient filtering
  const discussionTitle = `[slug:${pageSlug}] ${title}`;

  const discussionBody = `
## Documentation Feedback

**Page**: [${pageUrl}](${pageUrl})
**Selected Text**:
> ${selectedText}

## User Feedback
${body}

---
*This feedback was submitted through the documentation site.*

<!-- FEEDBACK_METADATA
${JSON.stringify({
  version: 1,
  page: pageUrl,
  selection: {
    text: selectedText,
    context: {
      prefix: prefixText,  // 50 chars before selection
      suffix: suffixText,  // 50 chars after selection
    },
    structure: {
      heading: nearestHeading,
      paragraphIndex: paragraphIdx,
    },
    charOffsets: {
      start: startOffset,
      end: endOffset,
      containerId: containerId
    }
  },
  timestamp: new Date().toISOString()
})}
-->`;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        repositoryId: REPO_ID,
        categoryId: FEEDBACK_CATEGORY_ID,
        title: discussionTitle,  // Now includes [slug:...]
        body: discussionBody
      }
    })
  });

  return response;
}
```

### Example: Fetching Feedback for a Page

```typescript
// src/pages/api/feedback/list.ts
export async function GET({ url }) {
  const pageUrl = url.searchParams.get('page');

  // Extract slug from page URL
  const pageSlug = new URL(pageUrl).pathname.replace('/docs/', '');
  const slugFilter = `[slug:${pageSlug}]`;

  // Use server token for public read access
  // Search for discussions with the slug in the title
  const query = `
    query GetDiscussions($query: String!, $first: Int!) {
      search(query: $query, type: DISCUSSION, first: $first) {
        nodes {
          ... on Discussion {
            id
            title
            body
            url
            createdAt
            author {
              login
              avatarUrl
            }
            comments(first: 5) {
              totalCount
              nodes {
                body
                author { login }
              }
            }
          }
        }
      }
    }
  `;

  // Search query includes repo and slug filter
  const searchQuery = `repo:fluxzero-io/fluxzero-docs "${slugFilter}" in:title`;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_SERVER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: {
        query: searchQuery,
        first: 100
      }
    })
  });

  const data = await response.json();

  // Parse metadata from each discussion
  const pageFeedback = data.data.search.nodes
    .map(discussion => {
      // Extract metadata from HTML comment
      const metadataMatch = discussion.body.match(/<!-- FEEDBACK_METADATA\n(.*?)\n-->/s);
      let metadata = null;
      if (metadataMatch) {
        try {
          metadata = JSON.parse(metadataMatch[1]);
        } catch (e) {
          console.warn('Failed to parse feedback metadata:', e);
        }
      }

      return {
        ...discussion,
        metadata,
        // Clean body for display (remove metadata comment)
        displayBody: discussion.body.replace(/<!-- FEEDBACK_METADATA.*?-->/s, '')
      };
    });

  // Cache in KV for performance
  await env.GITHUB_API_CACHE.put(
    `feedback:${pageUrl}`,
    JSON.stringify(pageFeedback),
    { expirationTtl: 300 } // 5 minutes
  );

  return Response.json(pageFeedback);
}
```

## Conclusion

This system will significantly improve documentation quality by:
- Making it easy for users to provide contextual feedback
- Creating a community around documentation
- Identifying problematic areas quickly
- Building a feedback loop with users

The GitHub integration ensures that feedback is actionable and integrated with the existing development workflow.
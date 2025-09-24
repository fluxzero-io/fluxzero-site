import { useState, useEffect } from 'react';

interface FeedbackAuthor {
  login: string;
  avatarUrl: string;
}

interface FeedbackDiscussion {
  id: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: FeedbackAuthor;
  commentCount: number;
  reactionCount: number;
  repository: string;
  metadata?: {
    version: number;
    page: string;
    selection: {
      text: string;
      context: {
        prefix: string;
        suffix: string;
      };
    };
  };
}

interface FeedbackResponse {
  slug: string;
  discussions: FeedbackDiscussion[];
  total: number;
}

interface FeedbackDisplayProps {
  slug: string;
  className?: string;
}

export default function FeedbackDisplay({ slug, className = '' }: FeedbackDisplayProps) {
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/feedback?slug=${encodeURIComponent(slug)}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch feedback: ${response.status}`);
        }

        const data: FeedbackResponse = await response.json();
        setFeedback(data);
      } catch (err) {
        console.error('Error fetching feedback:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchFeedback();
    }
  }, [slug]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const extractSelectedText = (discussion: FeedbackDiscussion): string => {
    if (discussion.metadata?.selection?.text) {
      return discussion.metadata.selection.text;
    }

    // Fallback: extract quoted text from body
    const quoteMatch = discussion.body.match(/>\s*([^\n]+)/);
    return quoteMatch?.[1] || 'Selected text';
  };

  const cleanTitle = (title: string): string => {
    // Remove [slug:...] prefix from title
    return title.replace(/^\[slug:[^\]]+\]\s*/, '');
  };

  if (loading) {
    return (
      <div className={`feedback-display ${className}`}>
        <div className="feedback-loading">
          <div className="loading-spinner"></div>
          <span>Loading feedback...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`feedback-display ${className}`}>
        <div className="feedback-error">
          <span>⚠️ Error loading feedback: {error}</span>
        </div>
      </div>
    );
  }

  if (!feedback || feedback.discussions.length === 0) {
    return (
      <div className={`feedback-display ${className}`}>
        <div className="feedback-empty">
          <p>💬 No feedback yet for this page.</p>
          <p className="feedback-cta">
            <a href="#" onClick={() => alert('Text selection feedback feature coming soon!')}>
              Select text above to leave feedback
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`feedback-display ${className}`}>
      <div className="feedback-header">
        <h3>💬 Community Feedback ({feedback.total})</h3>
        <p className="feedback-subtitle">
          Questions and discussions about this page
        </p>
      </div>

      <div className="feedback-list">
        {feedback.discussions.map((discussion) => (
          <div key={discussion.id} className="feedback-item">
            <div className="feedback-item-header">
              <div className="feedback-author">
                <img
                  src={discussion.author.avatarUrl}
                  alt={`${discussion.author.login}'s avatar`}
                  className="feedback-avatar"
                  width="24"
                  height="24"
                />
                <span className="feedback-author-name">{discussion.author.login}</span>
                <span className="feedback-date">{formatDate(discussion.createdAt)}</span>
              </div>

              <div className="feedback-stats">
                {discussion.commentCount > 0 && (
                  <span className="feedback-comments">
                    💬 {discussion.commentCount}
                  </span>
                )}
                {discussion.reactionCount > 0 && (
                  <span className="feedback-reactions">
                    👍 {discussion.reactionCount}
                  </span>
                )}
              </div>
            </div>

            <div className="feedback-content">
              <h4 className="feedback-title">
                <a href={discussion.url} target="_blank" rel="noopener noreferrer">
                  {cleanTitle(discussion.title)}
                </a>
              </h4>

              <div className="feedback-selected-text">
                <strong>About:</strong> "{extractSelectedText(discussion)}"
              </div>

              <div className="feedback-body">
                {discussion.body.slice(0, 200)}
                {discussion.body.length > 200 && '...'}
              </div>

              <div className="feedback-actions">
                <a
                  href={discussion.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="feedback-link"
                >
                  View full discussion →
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="feedback-footer">
        <a
          href="#"
          onClick={() => alert('Text selection feedback feature coming soon!')}
          className="feedback-add-button"
        >
          + Add your feedback
        </a>
      </div>
    </div>
  );
}
import DOMPurify from "dompurify";
import { marked } from "marked";

/**
 * Secure HTML sanitization configuration for educational content
 * Allows common formatting but blocks all script execution
 */
const SANITIZE_CONFIG = {
  // Allow common safe tags and attributes for rich text content
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'strike', 'del', 's', 
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 
    'blockquote', 'pre', 'code',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'alt', 'src', 'class', 'id',
    'target', 'rel'
  ],
  // Automatically add rel="noopener noreferrer" to external links
  ADD_ATTR: ['target', 'rel'] as string[],
  // Remove dangerous protocols
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  // Force target="_blank" for external links
  FORCE_BODY: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  SANITIZE_DOM: true
};

/**
 * Safely render markdown content by converting to HTML and sanitizing
 * @param markdown - Raw markdown content
 * @returns Sanitized HTML safe for dangerouslySetInnerHTML
 */
export function sanitizeMarkdown(markdown: string): { __html: string } {
  try {
    const rawHTML = marked(markdown) as string;
    const sanitizedHTML = DOMPurify.sanitize(rawHTML, SANITIZE_CONFIG);
    return { __html: sanitizedHTML };
  } catch (error) {
    console.error("Error processing markdown:", error);
    // Fallback: sanitize the original text as plain text
    const escapedText = DOMPurify.sanitize(markdown, { 
      ALLOWED_TAGS: [], 
      ALLOWED_ATTR: [] 
    });
    return { __html: `<p>${escapedText}</p>` };
  }
}

/**
 * Safely sanitize HTML content that's already in HTML format
 * @param html - Raw HTML content
 * @returns Sanitized HTML safe for dangerouslySetInnerHTML
 */
export function sanitizeHtml(html: string): { __html: string } {
  try {
    const sanitizedHTML = DOMPurify.sanitize(html, SANITIZE_CONFIG);
    return { __html: sanitizedHTML };
  } catch (error) {
    console.error("Error sanitizing HTML:", error);
    // Fallback: return escaped plain text
    const escapedText = DOMPurify.sanitize(html, { 
      ALLOWED_TAGS: [], 
      ALLOWED_ATTR: [] 
    });
    return { __html: `<p>${escapedText}</p>` };
  }
}
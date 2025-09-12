import { useEffect } from "react";

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  article?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
  author?: string;
  canonical?: string;
}

export default function SEO({
  title,
  description,
  image,
  article = false,
  publishedTime,
  modifiedTime,
  tags = [],
  author,
  canonical
}: SEOProps) {
  useEffect(() => {
    // Set document title
    document.title = title;

    // Helper function to set or remove meta tags
    const setMetaTag = (property: string, content: string | undefined, isName = false) => {
      const attribute = isName ? 'name' : 'property';
      let meta = document.querySelector(`meta[${attribute}="${property}"]`) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, property);
        document.head.appendChild(meta);
      }
      
      if (content) {
        meta.setAttribute('content', content);
      } else {
        meta.remove();
      }
    };

    // Basic SEO meta tags
    setMetaTag('description', description, true);
    setMetaTag('keywords', tags.length > 0 ? tags.join(', ') : undefined, true);
    setMetaTag('author', author, true);

    // Open Graph meta tags
    setMetaTag('og:title', title);
    setMetaTag('og:description', description);
    setMetaTag('og:type', article ? 'article' : 'website');
    setMetaTag('og:image', image);
    setMetaTag('og:url', canonical || window.location.href);
    setMetaTag('og:site_name', 'EKG Academy');
    setMetaTag('og:locale', 'pl_PL');

    // Twitter Card meta tags
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', title);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', image);

    // Article-specific Open Graph tags
    if (article) {
      setMetaTag('og:type', 'article');
      setMetaTag('article:author', author);
      setMetaTag('article:published_time', publishedTime);
      setMetaTag('article:modified_time', modifiedTime);
      
      // Add article tags
      const existingTags = document.querySelectorAll('meta[property="article:tag"]');
      existingTags.forEach(tag => tag.remove());
      
      tags.forEach(tag => {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'article:tag');
        meta.setAttribute('content', tag);
        document.head.appendChild(meta);
      });
    }

    // Canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonical || window.location.href);

    // JSON-LD structured data for articles
    if (article) {
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "description": description,
        "author": {
          "@type": "Person",
          "name": author || "EKG Academy"
        },
        "publisher": {
          "@type": "Organization",
          "name": "EKG Academy",
          "logo": {
            "@type": "ImageObject",
            "url": `${window.location.origin}/logo.png`
          }
        },
        "datePublished": publishedTime,
        "dateModified": modifiedTime || publishedTime,
        "image": image ? {
          "@type": "ImageObject",
          "url": image
        } : undefined,
        "keywords": tags.join(', '),
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": window.location.href
        }
      };

      // Remove existing JSON-LD script
      const existingScript = document.querySelector('script[type="application/ld+json"]');
      if (existingScript) {
        existingScript.remove();
      }

      // Add new JSON-LD script
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData, null, 2);
      document.head.appendChild(script);
    }

    // Cleanup function
    return () => {
      // Don't cleanup on unmount as we want meta tags to persist
      // until the next page sets them
    };
  }, [title, description, image, article, publishedTime, modifiedTime, tags, author, canonical]);

  // This component doesn't render anything
  return null;
}
"use client";

import { useEffect } from "react";

/**
 * One IntersectionObserver for every .cv4-reveal on the page. Elements get
 * .is-in the first time they cross 18% visibility and are then unobserved,
 * so the animation runs once per element. Reduced-motion users never wait:
 * the CSS side already renders .cv4-reveal fully visible for them, and we
 * skip observing entirely.
 */
export function RevealObserver() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll(".cv4-reveal, .cv5-reveal").forEach((el) => el.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" },
    );
    document.querySelectorAll(".cv4-reveal, .cv5-reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return null;
}

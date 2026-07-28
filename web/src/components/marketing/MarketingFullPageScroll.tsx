"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SECTION_SELECTOR = "[data-snap-section]";
const COOLDOWN_MS = 900;
const WHEEL_THRESHOLD = 40;

function sectionList(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(SECTION_SELECTOR));
}

function currentSectionIndex(sections: HTMLElement[]): number {
  if (sections.length === 0) return 0;
  const y = window.scrollY + window.innerHeight * 0.4;
  let best = 0;
  for (let i = 0; i < sections.length; i += 1) {
    if (sections[i].offsetTop <= y) best = i;
  }
  return best;
}

function isPastLastSection(sections: HTMLElement[]): boolean {
  const last = sections[sections.length - 1];
  if (!last) return false;
  return window.scrollY > last.offsetTop + last.offsetHeight * 0.55;
}

function scrollToSection(el: HTMLElement) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

/**
 * Homepage full-page scroll: one wheel / swipe moves to the next or previous
 * full-viewport section with a smooth animation.
 */
export function MarketingFullPageScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    let locked = false;
    let unlockTimer: number | null = null;
    let touchStartY: number | null = null;
    let wheelCarry = 0;

    const lockBriefly = () => {
      locked = true;
      wheelCarry = 0;
      if (unlockTimer) window.clearTimeout(unlockTimer);
      unlockTimer = window.setTimeout(() => {
        locked = false;
        unlockTimer = null;
      }, COOLDOWN_MS);
    };

    const go = (direction: 1 | -1) => {
      const sections = sectionList();
      if (sections.length === 0) return false;

      if (isPastLastSection(sections) && direction < 0) {
        lockBriefly();
        scrollToSection(sections[sections.length - 1]);
        return true;
      }

      const index = currentSectionIndex(sections);
      const next = Math.min(sections.length - 1, Math.max(0, index + direction));
      if (next === index) return false;
      lockBriefly();
      scrollToSection(sections[next]);
      return true;
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      const nested = target?.closest?.("[data-snap-scroll]") as HTMLElement | null;
      if (nested) {
        const delta = event.deltaY;
        const atTop = nested.scrollTop <= 0;
        const atBottom = nested.scrollTop + nested.clientHeight >= nested.scrollHeight - 2;
        if ((delta < 0 && !atTop) || (delta > 0 && !atBottom)) {
          wheelCarry = 0;
          return;
        }
      }

      const sections = sectionList();
      if (sections.length === 0) return;

      // Free scroll in the footer after the last full panel.
      if (isPastLastSection(sections)) {
        if (event.deltaY < 0) {
          event.preventDefault();
          if (!locked) go(-1);
        } else {
          wheelCarry = 0;
        }
        return;
      }

      const index = currentSectionIndex(sections);
      if (index === sections.length - 1 && event.deltaY > 0) {
        wheelCarry = 0;
        return;
      }
      if (index === 0 && event.deltaY < 0) {
        wheelCarry = 0;
        return;
      }

      event.preventDefault();
      if (locked) return;

      wheelCarry += event.deltaY;
      if (Math.abs(wheelCarry) < WHEEL_THRESHOLD) return;
      const direction: 1 | -1 = wheelCarry > 0 ? 1 : -1;
      wheelCarry = 0;
      go(direction);
    };

    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? null;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (touchStartY == null || locked) {
        touchStartY = null;
        return;
      }
      const endY = event.changedTouches[0]?.clientY ?? touchStartY;
      const delta = touchStartY - endY;
      touchStartY = null;
      if (Math.abs(delta) < 48) return;

      const sections = sectionList();
      const index = currentSectionIndex(sections);
      if (isPastLastSection(sections) && delta < 0) {
        go(-1);
        return;
      }
      if (index === sections.length - 1 && delta > 0) return;
      if (index === 0 && delta < 0) return;
      go(delta > 0 ? 1 : -1);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (locked) return;
      if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
        const tag = (event.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        const sections = sectionList();
        const index = currentSectionIndex(sections);
        if (index === sections.length - 1 || isPastLastSection(sections)) return;
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        go(-1);
      }
    };

    document.documentElement.classList.add("marketing-fullpage-scroll");
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.documentElement.classList.remove("marketing-fullpage-scroll");
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      if (unlockTimer) window.clearTimeout(unlockTimer);
    };
  }, [pathname]);

  return null;
}

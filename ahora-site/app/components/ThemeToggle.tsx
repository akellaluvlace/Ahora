"use client";

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const StyledWrapper = styled.div`
  .toggle {
    /* Integration with existing theme variables */
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text); /* Sets the color for the SVG icons */
    
    /* Base styles from the new component */
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    cursor: pointer;
    line-height: 1;
    transition: background-color 0.2s, border-color 0.2s, color 0.2s;
  }

  .input {
    display: none;
  }

  .icon {
    grid-column: 1 / 1;
    grid-row: 1 / 1;
    transition: transform 500ms;
    line-height: 0.1; /* Aligns SVG inside the grid cell */
  }

  /*
    Animation Logic:
    - Default (unchecked): Moon is visible, representing Dark Mode.
    - Checked: Sun is visible, representing Light Mode.
  */

  .icon--moon {
    transition-delay: 200ms;
  }

  .icon--sun {
    transform: scale(0);
  }

  #switch:checked + .icon--moon {
    transform: rotate(360deg) scale(0);
  }

  #switch:checked ~ .icon--sun {
    transition-delay: 200ms;
    transform: scale(1) rotate(360deg);
  }
`;

export default function ThemeToggle() {
  // Explicitly type the state to allow boolean or undefined.
  const [isDark, setIsDark] = useState<boolean | undefined>(undefined);

  // Effect to determine and apply the theme on client-side mount and on change.
  useEffect(() => {
    const root = document.documentElement;

    // Determine the initial theme only once.
    if (isDark === undefined) {
      const savedTheme = localStorage.getItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(savedTheme === 'dark' || (!savedTheme && prefersDark));
      return;
    }
    
    // Apply the theme class and update localStorage whenever isDark changes.
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  // Render a placeholder or nothing until the theme is determined to prevent flashing.
  if (isDark === undefined) {
    return <div style={{ width: '56px', height: '56px' }} aria-hidden="true" />;
  }
  
  return (
    <StyledWrapper>
      <label htmlFor="switch" className="toggle" title="Toggle theme" aria-label="Toggle theme">
        {/* The checkbox is 'checked' when the theme is LIGHT (!isDark) */}
        <input
          type="checkbox"
          className="input"
          id="switch"
          checked={!isDark}
          onChange={() => setIsDark(prev => !prev)}
        />
        <div className="icon icon--moon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width={32} height={32}>
            <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="icon icon--sun">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width={32} height={32}>
            <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
          </svg>
        </div>
      </label>
    </StyledWrapper>
  );
}
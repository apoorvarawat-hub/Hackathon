# Milestone 1 — Salesforce Account Selection Screen Design

## Overview
This document outlines the design and architecture for **Milestone 1 — User Selects Salesforce Account** of the Autonomous Salesforce Contact Discovery Agent. The application is built using a local Python Flask backend and a highly polished, responsive Vanilla JS/HTML/CSS frontend following the **myKaarma brand guidelines**.

---

## 1. User Interface & Brand Styling

### Visual Language & Core Tokens
The design adheres to myKaarma's official styling system:
* **Lato Font**: Applied globally for modern, readable typography.
* **Colors**:
  * **Primary (Blue)**: `--primary-color` (`#0377B3`) for active components, selections, and interactive text.
  * **Secondary Highlight**: `--secondary-color` (`#D3E4F1`) for selected states and active navigation backgrounds.
  * **Logo Mark**: Orange `#ED6D22` for the brand identity logo box.
  * **Main Background**: `--bg-main` (`#FFFFFF` in Light Mode, `#0F1117` in Dark Mode).
  * **Card Surface**: `--bg-card` (`#FFFFFF` in Light Mode, `#232839` in Dark Mode).
* **Borders**: Sleek borders `1px solid var(--border, #E9EAEB)` instead of heavy shadows for a premium, clean layout.

### Layout Structure
* **Sidebar (220px)**:
  * Brand logo header (52px tall) with orange `mk` mark and custom styled wordmark.
  * Nav groups containing functional navigation items (with Material Icons).
  * Footer containing a standard user avatar (`JD`) and the theme toggle (Light/Dark mode) with a custom animated pill.
* **Top Bar (52px)**:
  * Left: Page title and custom breadcrumb (`Home › Discovery Agent`).
  * Right: A primary search/filter action control.
* **Main Work Area**:
  * A split layout containing:
    1. **Search & Filter Panel (Left/Center)**: A premium card component housing search inputs (Name, Dealer Code, Region) and a highly responsive account grid/table with hover effects.
    2. **Selected Account Context Panel (Right)**: An elegant card showing detailed information about the selected Salesforce Account, featuring a highlighted, clickable Website URL.

---

## 2. Technical Architecture

### Backend (Python Flask)
A clean `app.py` server provides:
* **Static Asset Serving**: Serves front-end HTML, CSS, and JS.
* **Mock Salesforce Accounts API**:
  * `GET /api/accounts`: Returns list of Salesforce Accounts. Supports search query filtering by `name`, `code`, and `region`.
* **Mock Salesforce Data**: A robust dataset representing real-world dealership accounts with varying names, codes, regions, and websites.

### Frontend (Vanilla JS, HTML5, CSS3)
* **`index.html`**: Semantic HTML5 structure utilizing variables and structured sections.
* **`theme.css`**: Predefined light/dark tokens using custom property overrides scoped to `#shell.light` and `#shell.dark`.
* **`app.js`**:
  * State management: Tracks active theme, search query parameters, account list, and currently selected account.
  * DOM Rendering: Performs smooth list transitions and populates detail panels when accounts are selected.
  * Event Listeners: Attaches to search inputs for debounce-controlled dynamic queries.

---

## 3. Interaction & Micro-Animations
* **Interactive Table Rows**: Hovering over an account row changes the background color smoothly to `var(--row-hover)`. Selecting a row highlights it using `var(--secondary-color)`.
* **Smooth Transitions**: Height and opacity animations when search results are updated.
* **Dark Mode Transition**: The dark/light mode toggle in the sidebar footer updates page tokens smoothly via class-swapping on `#shell`.

---

## 4. Verification Plan

### Automated/Local Checks
* Verify Flask server launches without errors on port `5000`.
* Confirm `/api/accounts` endpoint returns valid mock JSON.
* Ensure search query filtering works via the API.

### Manual Visual Verification
* Check Lato font loading and correct sizing hierarchy.
* Test Light/Dark theme toggle responsiveness and correct color palette switches.
* Verify account selection completed under 10 seconds and website URL auto-populates correctly.

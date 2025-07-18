## Sidebar Refactoring Plan

**Goal**: Refactor `sidebar.html` and `components.js` to eliminate code duplication, fix conflicting logic, and improve performance and maintainability.

### Phase 1: Clean up `sidebar.html`

1.  **Remove All JavaScript**: The entire `<script>` tag and its contents will be deleted. All logic will be centralized in `components.js`.
2.  **Remove Hardcoded Data**: Placeholder content like the username ("Alex"), badge number ("1234"), and balance ("$1,234.56") will be removed from the HTML. This prevents the user from seeing a flash of incorrect information before the real data is loaded. The elements will be left empty, to be populated by `components.js`.

### Phase 2: Refactor `components.js`

1.  **Centralize All Sidebar Logic**: Consolidate all sidebar-related functionality that is currently in `sidebar.html` into `components.js`. This includes:
    *   User data fetching and UI updates.
    *   Event handling for the logout button, close button, and currency change button.
    *   State management for the sidebar's visibility.

2.  **Create a Single Source of Truth for Data**:
    *   A new `fetchSidebarData` function will be created to get all necessary data (`/api/user/profile` and `/api/user/balances`) efficiently, using `Promise.all` to run requests in parallel.
    *   This eliminates the current redundant and conflicting API calls.

3.  **Separate Data from Presentation**:
    *   A dedicated `updateSidebarUI` function will be responsible for taking the fetched data object and updating the corresponding DOM elements. This cleanly separates the data-fetching logic from the UI manipulation logic.

4.  **Robust Initialization and Event Handling**:
    *   The `initializeSidebarScripts` function will become the single entry point for making the sidebar interactive after it's loaded.
    *   It will attach all necessary event listeners.
    *   It will trigger the initial data load.

5.  **Fix Periodic Refresh**:
    *   The `setInterval` logic for refreshing sidebar data will be fixed to correctly pause when the browser tab is hidden and resume when it becomes visible again, preventing unnecessary background requests.

By following this plan, we will have a clean, maintainable, and performant sidebar component with a clear separation of concerns.

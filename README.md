# Sorairei NPC Maker

Sorairei NPC Maker is a specialized visual editor designed for the rapid creation of NPCs within the **Canary Server** ecosystem (RevScripts). This tool provides a professional interface for configuring character attributes, visual appearances, and trade systems with absolute precision.

---

## Technical Specifications

| Feature | Description |
| :--- | :--- |
| **System Compatibility** | Native support for Canary Server RevScripts. |
| **Visual Outfitter** | Real-time preview for 240+ outfits including Male, Female, and Monsters. |
| **Color Management** | Full RGB palette support for Head, Primary, Secondary, and Detail components. |
| **Trade System** | Integrated item catalog with search-by-ID and search-by-name functionality. |
| **Keyword Handler** | Support for custom conversation triggers and automated responses. |
| **Lua Generator** | Exports high-cleanliness code following the official RevScript standards. |

---

## Core Functionality

### Character Customization
The editor allows for full control over the NPC's visual identity. Users can select look-types, manage addons, and assign mounts while having a persistent real-time preview of the character's appearance.

### NPC Trade Integration
A comprehensive trade list manager is included, allowing for the configuration of purchase and sale prices directly within the UI. The internal database is synced to ensure ID consistency with modern server distributions.

### Advanced Dialogue Configuration
Custom interaction keywords can be implemented through a streamlined interface. The generator automatically maps these triggers to the `keywordHandler` system used by Canary.

---

## Security and Integrity

The application implements several layers of data protection to ensure server stability:

*   **HTML Sanitization**: All user-provided strings are passed through a sanitization layer to prevent cross-site scripting (XSS).
*   **Lua Logic Escaping**: Dialogue strings and item names are escaped to handle special characters, preventing Lua syntax errors during server loading.
*   **RevScript Formatting**: Generated code utilizes tabbed indentation and multiline block structures for maximum readability and server-side compatibility.

---

## Implementation & Usage

1.  **Deployment**: Open `index.html` in a standard web browser.
2.  **Configuration**: Define NPC attributes (health, radius), visual properties, and trade items.
3.  **Export**: Utilize the **Generate .LUA** feature to produce a standards-compliant script.
4.  **Install**: Place the exported `.lua` file into the server's `data/npc` directory.

### Validation

With Node.js 18 or newer installed, run the dependency-free syntax and generator test suite:

```bash
npm run check
```

---

## License

This project is licensed under the **MIT License**. Refer to the `LICENSE` file for full legal documentation.

---

*Note: Individual application logic is client-side; however, character visual previews require an active connection to the Oracle OTS API for asset rendering.*

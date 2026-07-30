# Unified PDF Report Template System

This directory contains a professional, government-style PDF template system designed for server-side rendering with tools like **jsreport** (using the `chrome-pdf` recipe) or **Puppeteer**.

## Architecture Overview

The system is designed for maximum flexibility and maintainability by separating design, structure, and data.

1.  **`base-template.html`**: This is the master layout file. It defines the document structure (`<html>`, `<body>`), links to the stylesheet, and contains the fixed header and footer structure that appears on every page. It uses a `{{{content}}}` placeholder where a specific report block is injected. The `<body>` tag has a class `{{document.type}}` which allows the CSS to apply different page styles (e.g., portrait vs. landscape).

2.  **`styles.css`**: This is the global print-optimized stylesheet.
    *   **Design Control**: At the top, a `:root` block defines all design tokens (colors, fonts, spacing) as CSS variables. To change the look and feel of all reports, you only need to modify these variables. These can be dynamically overridden in a `<style>` block by your server-side script.
    *   **Page Layout**: It defines `@page` rules for different document types (`.report`, `.receipt`, `.card-grid`) to control orientation and margins.
    *   **Core Components**: It includes styles for headers, footers, and professional, Excel-like tables with support for page breaking and repeating headers.

3.  **`list-templates.html`**: This file contains a collection of pre-designed, reusable HTML blocks for different content types (reports, receipts, cards). Your server-side logic will select the appropriate block, populate it with data, and inject it into the `base-template.html`.

## How to Use with jsreport

This system is optimized for use with jsreport and the `chrome-pdf` recipe.

1.  **Engine**: Set the template engine to `handlebars`.
2.  **Recipe**: Use `chrome-pdf`.
3.  **Template Structure**:
    *   Your main jsreport template (`content`) will contain the logic to select and render a content block from `list-templates.html`.
    *   Create a child template (`#asset`) for `styles.css` and another for `base-template.html`.
    *   Your main template will wrap the rendered content with the base layout.

**Example jsreport Script:**

```javascript
// Example jsreport script (conceptual)
async function beforeRender(req, res) {
    // 1. Choose content block based on document type
    let contentBlock;
    if (req.data.document.type === 'report') {
        contentBlock = `{{> salesReport}}`; // Assuming salesReport is a partial
    } else if (req.data.document.type === 'receipt') {
        contentBlock = `{{> paymentReceipt}}`;
    } // etc.

    // 2. Inject the chosen block into the main content placeholder
    req.data.content = contentBlock;
}
```

## Example JSON Data Payload

Your ERP should send a JSON object structured like this to jsreport:

```json
{
  "settings": {
    "primaryColor": "#0d47a1",
    "headerBg": "#f8f9fa",
    "tableHeaderBg": "#e9ecef",
    "borderColor": "#dee2e6",
    "baseFontFamily": "Arial, sans-serif",
    "baseFontSize": "10pt",
    "headerFontSize": "16pt",
    "cellPadding": "8px",
    "sectionSpacing": "25px",
    "companyLogoUrl": "https://example.com/logo.png",
    "officeText": "Head Office, Sulaimaniyah",
    "footerNote": "Internal Use Only"
  },
  "document": {
    "type": "report",
    "title": "Monthly Sales Summary",
    "date": "October 26, 2023",
    "number": "REP-2023-10-001"
  },
  "data": {
    "listTitle": "October Sales Transactions",
    "items": [
      { "index": 1, "itemName": "Ergonomic Office Chair", "quantity": 10, "unitPrice": 150.00, "totalPrice": 1500.00 },
      { "index": 2, "itemName": "Electric Standing Desk", "quantity": 5, "unitPrice": 400.00, "totalPrice": 2000.00 }
    ]
  },
  "totalPages": 5
}
```

## Troubleshooting & Best Practices

*   **Text Overflow**: Long text in table cells is handled by `word-break: break-word`. Ensure your server doesn't send excessively long, unbroken strings.
*   **Page Breaks**:
    *   `thead { display: table-header-group; }` ensures headers repeat on each new page.
    *   `tr { page-break-inside: avoid; }` prevents a single table row from being split across two pages.
*   **Scaling & DPI**: The `chrome-pdf` recipe in jsreport generally handles DPI well. If you encounter scaling issues, ensure your `@page` size in CSS matches the `paper` settings in your jsreport configuration. Avoid using `zoom` or `transform: scale()` for the whole body.
*   **Fonts**: For custom fonts (like those for Kurdish/Arabic), ensure the font file is accessible to the server. You can either link to it via a URL in the CSS or embed it as a Base64 asset.

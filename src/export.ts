/**
 * Migration history export functionality
 */

import * as fs from "fs";
import { MigrationRecord, ExportFormat, ExportOptions } from "./types";

interface ExportData {
  generatedAt: string;
  totalMigrations: number;
  migrations: Array<{
    id: string;
    name: string;
    createdAt: string;
    executedAt: string;
    duration: number;
    durationFormatted: string;
  }>;
}

/**
 * Export migration history to various formats
 */
export function exportMigrations(
  migrations: MigrationRecord[],
  options: ExportOptions
): string {
  const data: ExportData = {
    generatedAt: new Date().toISOString(),
    totalMigrations: migrations.length,
    migrations: migrations.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      executedAt: m.executedAt.toISOString(),
      durationFormatted: formatDuration(m.duration),
    })),
  };

  switch (options.format) {
    case "json":
      return exportToJSON(data);
    case "csv":
      return exportToCSV(data);
    case "html":
      return exportToHTML(data);
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

/**
 * Export to JSON format
 */
function exportToJSON(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Export to CSV format
 */
function exportToCSV(data: ExportData): string {
  const lines: string[] = [
    "ID,Name,Created At,Executed At,Duration (ms),Duration",
  ];

  for (const m of data.migrations) {
    lines.push(
      `"${m.id}","${m.name}","${m.createdAt}","${m.executedAt}",${m.duration},"${m.durationFormatted}"`
    );
  }

  return lines.join("\n");
}

/**
 * Export to HTML format
 */
function exportToHTML(data: ExportData): string {
  const rows = data.migrations
    .map(
      (m) => `
    <tr>
      <td>${escapeHtml(m.id)}</td>
      <td>${escapeHtml(m.name)}</td>
      <td>${m.createdAt}</td>
      <td>${m.executedAt}</td>
      <td>${m.durationFormatted}</td>
    </tr>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Migration History Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 {
      color: #333;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    .meta {
      color: #666;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #333;
      color: white;
      font-weight: 600;
    }
    tr:hover {
      background: #f9f9f9;
    }
    .status-success {
      color: #10b981;
    }
  </style>
</head>
<body>
  <h1>🗄️ Migration History Report</h1>
  <div class="meta">
    <p>Generated: ${data.generatedAt}</p>
    <p>Total Migrations: ${data.totalMigrations}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Created At</th>
        <th>Executed At</th>
        <th>Duration</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>
`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = { toString: () => text }; // Placeholder for SSR safety
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Write export to file or return as string
 */
export function writeExport(
  migrations: MigrationRecord[],
  options: ExportOptions
): string {
  const content = exportMigrations(migrations, options);

  if (options.output) {
    fs.writeFileSync(options.output, content, "utf8");
    return options.output;
  }

  return content;
}

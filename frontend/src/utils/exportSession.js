import { apiFetchJson } from '../lib/apiFetch'

export async function exportSessionToMarkdown(sessionId) {
    try {
        const data = await apiFetchJson(`/api/context/export/${sessionId}`);

        const tabs = data.tabs || {};
        const session = data.session || {};
        const stats = data.stats || { tab_count: 0, query_count: 0, result_count: 0, visited_count: 0 };

        
        const date = new Date().toISOString().split('T')[0];
        const lines = [];


        lines.push(`# SuperBrowser Session Export`);
        lines.push(`**Date:** ${date}`);
        lines.push(`**Session ID:** ${sessionId}`);
        if (session?.started_at) lines.push(`**Started:** ${session.started_at}`);
        if (session?.ended_at) lines.push(`**Ended:** ${session.ended_at}`);
        lines.push(`**Status:** ${session?.status || 'unknown'}`);
        lines.push('');
        lines.push(`> **Stats:** ${stats.tab_count} tab(s) · ${stats.query_count} queries · ${stats.result_count} results · ${stats.visited_count} visited pages`);
        lines.push('');
        lines.push('---');
        lines.push('');

        const tabEntries = Object.entries(tabs);

        if (tabEntries.length === 0) {
            lines.push('*No tab data recorded in this session.*');
        }

        tabEntries.forEach(([tabId, tabData], index) => {
            lines.push(`## Tab ${index + 1} — \`${tabId}\``);
            lines.push('');


            const queries = tabData.queries || [];
            lines.push(`### Queries (${queries.length})`);
            if (queries.length === 0) {
                lines.push('*No queries recorded.*');
            } else {
                queries.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
            }
            lines.push('');


            const results = tabData.results || [];
            lines.push(`### Search Results (${results.length})`);
            if (results.length === 0) {
                lines.push('*No results recorded.*');
            } else {
                results.forEach((r) => {
                    lines.push(`#### ${r.title || 'Untitled'}`);
                    lines.push(`**URL:** ${r.url || 'Link'}`);
                    if (r.snippet) lines.push(`**Snippet:** ${r.snippet}`);
                    lines.push('');
                });
            }

            // Visited Pages
            const visited = tabData.visited_pages || [];
            lines.push(`### Visited Pages (${visited.length})`);
            if (visited.length === 0) {
                lines.push('*No pages visited.*');
            } else {
                visited.forEach((p) => {
                    lines.push(`#### ${p.title || 'Untitled Page'}`);
                    lines.push(`**URL:** ${p.url || 'Link'}`);
                    if (p.timestamp) lines.push(`**Visited:** ${p.timestamp}`);
                    if (p.content) lines.push(`\n> ${p.content.slice(0, 300).replace(/\n/g, ' ')}...`);
                    lines.push('');
                });
            }

            lines.push('---');
            lines.push('');
        });

        const markdown = lines.join('\n');
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `superbrowser-session-${date}.md`;
        a.click();
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error('Export failed:', err);
        alert('Failed to export session. Please try again.');
    }
}
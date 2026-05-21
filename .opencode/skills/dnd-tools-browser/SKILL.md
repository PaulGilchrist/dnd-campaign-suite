---
name: dnd-tools-browser
description: You provide browsing and content extraction capabilities for https://paulgilchrist.github.io/dnd-tools
---

## Description
This skill allows agents to:
- Fetch pages from the D&D Tools website
- Select HTML elements
- Extract text, tables, and structured content
- Follow internal links
- Return structured data for use in campaigns and encounters

## Capabilities
- fetch_url
- select_element
- extract_text
- extract_table
- extract_links

## Inputs
- **url** (string, required): The page to fetch  
- **selector** (string, optional): CSS selector for extracting specific content

## Outputs
- **content** (string): Raw or extracted text  
- **elements** (list): Selected DOM elements  
- **metadata** (object): Additional structured data

## Permissions
Allowed domains:
- paulgilchrist.github.io

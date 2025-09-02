export function create10kPrompt() {
  const ADDITIONAL_CONTEXT = "";

  return `

Extract the following basic information from the provided 10-K filing and present it in a structured format:

${ADDITIONAL_CONTEXT}

**Company Overview:**
- Company name and ticker symbol
- Business description (1-2 sentences)
- Primary industry/sector
- Headquarters location

**Financial Highlights:**
- Total revenue (current and prior year)
- Net income (current and prior year)
- Total assets
- Total shareholders' equity

**Key Business Information:**
- Number of employees
- Major business segments or divisions
- Primary geographic markets
- Main products/services

**Risk Factors:**
- List the top 3 most significant risk factors mentioned

Format your response clearly with headers and bullet points. If any information is not available in the document, note "Not specified" for that item.

## Example Output Format:

{
    "Company Overview": {
        "Name": "[Company Name] ([Ticker])",
        "Business": "[Brief description]",
        "Industry": "[Primary sector]",
        "Headquarters": "[City, State]"
    },
    "Financial Highlights": {
        "Revenue": "$X.X billion (current year), $X.X billion (prior year)",
        "Net Income": "$X.X billion (current year), $X.X billion (prior year)",
        "Total Assets": "$X.X billion",
        "Shareholders' Equity": "$X.X billion"
    },
    "Key Business Information": {
        "Number of Employees": "[Number]",
        "Major Segments": "[Segments]",
        "Geographic Markets": "[Markets]",
        "Products/Services": "[Products]"
    },
    "Risk Factors": [
        "[Risk 1]",
        "[Risk 2]",
        "[Risk 3]"
    ]
}`;
}

export function createNewsPrompt(news: string) {
  return `
NEWS: ${news}

Extract all significant company names mentioned in the provided news article and classify them by their relevance to the story.

**Instructions:**
- Identify all publicly traded companies, major private companies, and well-known organizations
- Include ticker symbols when available or easily identifiable
- Categorize companies by their role in the story
- Exclude generic references (e.g., "tech companies" without specific names)
- Include subsidiaries and brands if they are significant to the story

**Output Format:**
Return a JSON object with the following structure:

{
  "primary_companies": [
    {
      "name": "Company Name",
      "ticker": "TICK" | null,
      "role": "Brief description of their role in the story"
    }
  ],
  "secondary_companies": [
    {
      "name": "Company Name", 
      "ticker": "TICK" | null,
      "role": "Brief description of their role in the story"
    }
  ],
  "mentioned_companies": [
    {
      "name": "Company Name",
      "ticker": "TICK" | null,
      "context": "Brief context of mention"
    }
  ]
}

**Categories:**
- **primary_companies**: Companies that are the main focus of the article
- **secondary_companies**: Companies with significant involvement but not the main focus  
- **mentioned_companies**: Companies briefly referenced or used for comparison

**Example Output:**
{
  "primary_companies": [
    {
      "name": "Apple Inc.",
      "ticker": "AAPL",
      "role": "Announcing new product launch and quarterly earnings"
    }
  ],
  "secondary_companies": [
    {
      "name": "Samsung Electronics",
      "ticker": "005930.KS", 
      "role": "Main competitor mentioned in market analysis"
    }
  ],
  "mentioned_companies": [
    {
      "name": "Microsoft Corporation",
      "ticker": "MSFT",
      "context": "Referenced for market cap comparison"
    }
  ]
}
`;
}

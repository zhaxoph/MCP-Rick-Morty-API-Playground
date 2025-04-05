import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const RICK_AND_MORTY_API_URL = "https://rickandmortyapi.com/api/";
const USER_AGENT = "ricknmorty/1.0.0";

// Create a new server instance
const server = new McpServer({
  name: "rick-and-morty-api",
  description: "A simple API for fetching Rick and Morty characters",
  version: "1.0.0",
  capabilities: {
    tools: {},
  },
});

//Helper functions to fetch data from the API
const makeAPIRequest = async (url: string) => {
  const headers = {
    "User-Agent": USER_AGENT,
  };
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error making API request", error);
    return null;
  }
};

// Format the response from the API

interface Character {
  properties: {
    id?: number;
    name?: string;
    status?: string;
    species?: string;
  };
}

function formatCharacterResponse(character: Character) {
  const props = character.properties;
  return [
    `ID: ${props.id || "Unknown"}`,
    `Name: ${props.name || "Unknown"}`,
    `Status: ${props.status || "Unknown"}`,
    `Species: ${props.species || "Unknown"}`,
    "---",
  ].join("\n");
}

/* Implementing tool execution */
// Register API tools
server.tool(
  "get-character",
  "Fetch a character by ID",
  {
    id: z.number().min(1).max(826),
  },
  async ({ id }) => {
    const apiUrl = `${RICK_AND_MORTY_API_URL}character/${id}`;
    const characterData = await makeAPIRequest(apiUrl);
    if (!characterData) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching character with ID ${id}`,
          },
        ],
      };
    }
    
    // Format the single character response
    const formattedResponse = formatCharacterResponse({ properties: characterData });
    const characterInfo = `Character found:\n${formattedResponse}`;
    return {
      content: [
        {
          type: "text",
          text: characterInfo,
        },
      ],
    };
  }
);

server.tool(
  "get-characters",
  "Fetch characters with pagination",
  {
    page: z.number().min(1).optional().describe("Page number to fetch (default: 1)"),
    pageSize: z.number().min(1).max(20).optional().describe("Number of characters per page (default: 20, max: 20)")
  },
  async ({ page = 1, pageSize = 20 }) => {
    const apiUrl = `${RICK_AND_MORTY_API_URL}character?page=${page}`;
    const characterData = await makeAPIRequest(apiUrl);
    if (!characterData) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching characters`,
          },
        ],
      };
    }

    // The API returns paginated results with a results array
    const characters = characterData.results || [];
    if (characters.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No characters found on page ${page}`,
          },
        ],
      };
    }

    // Format each character in the results array
    const formattedResponses = characters.map((character: any) => 
      formatCharacterResponse({ properties: character })
    );
    
    const totalPages = characterData.info?.pages || 1;
    const characterInfo = `Characters found (Page ${page} of ${totalPages}):\n${formattedResponses.join("\n")}`;
    return {
      content: [
        {
          type: "text",
          text: characterInfo,
        },
      ],
    };
  }
);

async function main() {
  // Create a transport for the server
  const transport = new StdioServerTransport();

  // Start the server
  await server.connect(transport);
}

main().catch((error) => {
  process.exit(1);
});

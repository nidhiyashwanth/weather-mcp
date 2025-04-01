import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";

// Function to safely extract text content from MCP response
function extractTextFromResult(result: CallToolResult | undefined | null): string {
  if (!result?.content || result.content.length === 0) {
     if (!result) {
         console.warn("Received null or undefined result.");
         return "Error: Received null or undefined result.";
     }
     if (!result.content) {
         console.warn("Received result with no 'content' array. Format might be outdated:", JSON.stringify(result, null, 2));
         return "Error: Received result without 'content' array from server.";
     }
     if (result.content.length === 0) {
         console.log("Received result with empty content array.");
         return "Received empty content from server.";
     }
  }

  const firstContent = result.content[0];

  if (firstContent?.type === "text") {
    return (firstContent as TextContent).text;
  }

  console.warn("Received result format where first content part was not text:", JSON.stringify(result, null, 2));
  return "Error: Received result where first content part was not text.";
}


async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["build/index.js"], // This is where the server is located
  });

  const client = new Client(
    {
      name: "weather-cli-client-ts",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  let connected = false;

  try {
    console.log("Connecting to weather MCP server via stdio...");
    await client.connect(transport);
    connected = true;
    console.log("Successfully connected to server.");

    console.log("\n--- Requesting Weather Alerts for California (CA) ---");
    try {
      const alertsResult = await client.callTool({
        name: "get-alerts",
        arguments: {
          state: "CA",
        },
      }) as CallToolResult;
      console.log("Server Response (Alerts):");
      console.log(extractTextFromResult(alertsResult));

      console.log("\n--- Requesting Weather Alerts with Invalid State Code (XYZ) ---");
      const invalidAlertsResult = await client.callTool({
        name: "get-alerts",
        arguments: {
            state: "XYZ"
        }
      }) as CallToolResult;
      console.log("Server Response (Invalid Alerts):");
      console.log(extractTextFromResult(invalidAlertsResult));

    } catch (error: unknown) {
      console.error("Error calling 'get-alerts':");
      if (error instanceof ZodError) {
           console.error("Validation Error:", error.errors);
      } else if (error instanceof Error) {
           console.error(error.message);
           if ('cause' in error && error.cause) {
               console.error("Caused by:", error.cause);
           }
      } else {
           console.error("An unexpected error occurred:", error);
      }
    }

    // --- Call 'get-forecast' Tool ---
    console.log("\n--- Requesting Weather Forecast for New York City (approx coords) ---");
    const nycLatitude = 40.71;
    const nycLongitude = -74.00;
    try {
      const forecastResult = await client.callTool({
        name: "get-forecast",
        arguments: {
          latitude: nycLatitude,
          longitude: nycLongitude,
        },
      }) as CallToolResult;
      console.log("Server Response (Forecast):");
      console.log(extractTextFromResult(forecastResult));
    } catch (error: unknown) {
      console.error(`Error calling 'get-forecast' for ${nycLatitude}, ${nycLongitude}:`);
       if (error instanceof ZodError) {
           console.error("Validation Error:", error.errors);
       } else if (error instanceof Error) {
           console.error(error.message);
           if ('cause' in error && error.cause) {
               console.error("Caused by:", error.cause);
           }
      } else {
           console.error("An unexpected error occurred:", error);
      }
    }

    // --- Call 'get-forecast' for Location Outside US Coverage ---
    console.log("\n--- Requesting Weather Forecast for London (outside NWS coverage) ---");
    const londonLatitude = 51.51;
    const londonLongitude = -0.13;
     try {
      const londonForecastResult = await client.callTool({
        name: "get-forecast",
        arguments: {
          latitude: londonLatitude,
          longitude: londonLongitude,
        },
      }) as CallToolResult;
      console.log("Server Response (London Forecast):");
      console.log(extractTextFromResult(londonForecastResult));
    } catch (error: unknown) {
      console.error(`Error calling 'get-forecast' for ${londonLatitude}, ${londonLongitude}:`);
       if (error instanceof Error) {
           console.error(error.message);
           if ('cause' in error && error.cause) {
               console.error("Caused by:", error.cause);
           }
      } else {
           console.error("An unexpected error occurred:", error);
      }
    }

  } catch (error: unknown) {
    console.error("Failed to connect or critical communication error:");
     if (error instanceof Error) {
         console.error(error.message);
          if ('cause' in error && error.cause) {
               console.error("Caused by:", error.cause);
           }
     } else {
          console.error("An unexpected error occurred:", error);
     }
  } finally {
  }
}

// Run the main function
main().catch((error) => {
  console.error("Fatal error in client main function:", error instanceof Error ? error.message : error);
  if (error instanceof Error && 'cause' in error && error.cause) {
    console.error("Cause:", error.cause);
  }
  process.exit(1);
});
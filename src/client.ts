import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ZodError } from "zod";


// Function to safely extract text content from MCP response
function extractTextFromResult(result: any) {
  if (result?.content?.[0]?.type === "text" && typeof result.content[0].text === "string") {
    return result.content[0].text;
  }
  console.warn("Received unexpected result format:", JSON.stringify(result, null, 2));
  return "Error: Received unexpected result format from server.";
}

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["build/index.js"],
  });

  // --- 2. Initialize Client ---
  const client = new Client(
    {
      name: "weather-cli-client",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  try {
    // --- 3. Connect to Server ---
    console.log("Connecting to weather MCP server via stdio...");
    await client.connect(transport);
    console.log("Successfully connected to server.");

    // --- 4. Example: Call 'get-alerts' Tool ---
    console.log("\n--- Requesting Weather Alerts for California (CA) ---");
    try {
      const alertsResult = await client.callTool({
        name: "get-alerts",
        arguments: {
          state: "CA", // Must be a 2-letter state code
        },
      });
      console.log("Server Response (Alerts):");
      console.log(extractTextFromResult(alertsResult));

      console.log("\n--- Requesting Weather Alerts with Invalid State Code (XYZ) ---");
      const invalidAlertsResult = await client.callTool({
        name: "get-alerts",
        arguments: {
            state: "XYZ"
        }
      });
      console.log("Server Response (Invalid Alerts):");
      console.log(extractTextFromResult(invalidAlertsResult));


    } catch (error) {
      console.error("Error calling 'get-alerts':", error instanceof Error ? error.message : String(error));
       if (error instanceof ZodError) {
           console.error("Validation Errors:", error.errors);
       } else if (error instanceof Error && 'cause' in error) {
           console.error("Caused by:", error.cause);
       }
    }


    // --- 5. Example: Call 'get-forecast' Tool ---
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
      });
      console.log("Server Response (Forecast):");
      console.log(extractTextFromResult(forecastResult));
    } catch (error) {
      console.error(`Error calling 'get-forecast' for ${nycLatitude}, ${nycLongitude}:`, error instanceof Error ? error.message : String(error));
       if (error instanceof ZodError) {
           console.error("Validation Errors:", error.errors);
       } else if (error instanceof Error && 'cause' in error) {
           console.error("Caused by:", error.cause); // MCP errors often have a cause
       }
    }

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
      });
      console.log("Server Response (London Forecast):");
      console.log(extractTextFromResult(londonForecastResult));
    } catch (error) {
      console.error(`Error calling 'get-forecast' for ${londonLatitude}, ${londonLongitude}:`, error instanceof Error ? error.message : String(error));
      if (error instanceof Error && 'cause' in error) {
         console.error("Caused by:", error.cause);
      }
    }


  } catch (error) {
    console.error("Failed to connect or communicate with the server:", error);
     if (error instanceof Error && 'cause' in error) {
         console.error("Caused by:", error.cause);
     }
  } finally {
    // --- 6. Disconnect ---
    console.log("\nDisconnecting from server...");
    // await client.disconnect();
    console.log("Client disconnected.");
  }
}

// Run the main function
main().catch((error) => {
  console.error("Fatal error in client main function:", error);
  process.exit(1);
});
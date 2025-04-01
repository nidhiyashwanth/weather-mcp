import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

// Create server instance
const server = new McpServer({
  name: "weather",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Helper function for making NWS API requests
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      // Log the specific error status for better debugging
      console.error(`NWS API Error: ${response.status} ${response.statusText} for URL: ${url}`);
      return null;
    }
    // Check if the response body is empty or not JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/geo+json")) {
      console.error(`Unexpected content type: ${contentType} for URL: ${url}`);
      return null;
    }
    // If the response looks OK, parse it as JSON
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Error making NWS request to ${url}:`, error);
    return null;
  }
}

// Interfaces for typing NWS API responses and data structures
interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    headline?: string;
  };
}

interface AlertsResponse {
  features: AlertFeature[];
}

interface PointsResponseProperties {
    forecast?: string;
    relativeLocation?: {
        properties: {
            city?: string;
            state?: string;
        }
    }
}

interface PointsResponse {
  properties: PointsResponseProperties;
}


interface ForecastPeriod {
  number: number;
  name?: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature?: number;
  temperatureUnit?: string;
  temperatureTrend?: string | null;
  probabilityOfPrecipitation?: {
    unitCode: string;
    value: number | null;
  };
  dewpoint?: {
    unitCode: string;
    value: number | null;
  };
  relativeHumidity?: {
    unitCode: string;
    value: number | null;
  };
  windSpeed?: string;
  windDirection?: string;
  icon?: string;
  shortForecast?: string;
  detailedForecast?: string;
}


interface ForecastResponseProperties {
    updated: string;
    units: string;
    forecastGenerator: string;
    generatedAt: string;
    updateTime: string;
    validTimes: string;
    elevation: {
        unitCode: string;
        value: number | null;
    };
    periods: ForecastPeriod[];
}

interface ForecastResponse {
  properties: ForecastResponseProperties;
}


// Format alert data into a readable string
function formatAlert(feature: AlertFeature): string {
  const props = feature.properties;
  return [
    `Event: ${props.event || "Unknown Event"}`,
    `Area: ${props.areaDesc || "Unknown Area"}`,
    `Severity: ${props.severity || "Unknown Severity"}`,
    `Status: ${props.status || "Unknown Status"}`,
    `Headline: ${props.headline || "No headline provided."}`,
    "---",
  ].join("\n");
}

// Register weather tools
server.tool(
  "get-alerts",
  "Get weather alerts for a US state",
  {
    state: z.string().length(2, "State code must be exactly 2 letters").describe("Two-letter US state code (e.g. CA, NY)"),
  },
  async ({ state }) => {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts/active?area=${stateCode}`;
    console.error(`Fetching alerts for ${stateCode} from ${alertsUrl}`);

    const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

    if (!alertsData) {
        console.error(`Failed to retrieve alerts data for ${stateCode}`);
      return {
        content: [{ type: "text", text: `Failed to retrieve weather alerts data for ${stateCode}.` }],
      };
    }

    const features = alertsData.features || [];
    if (features.length === 0) {
      console.error(`No active alerts found for ${stateCode}`);
      return {
        content: [{ type: "text", text: `No active weather alerts found for ${stateCode}.` }],
      };
    }

    const formattedAlerts = features.map(formatAlert);
    const alertsText = `Active weather alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}`;
    console.error(`Successfully retrieved ${features.length} alerts for ${stateCode}`);

    return {
      content: [{ type: "text", text: alertsText }],
    };
  },
);

server.tool(
  "get-forecast",
  "Get the weather forecast for a specific US location using latitude and longitude",
  {
    latitude: z.number().min(-90).max(90).describe("Latitude of the location (degrees)"),
    longitude: z.number().min(-180).max(180).describe("Longitude of the location (degrees)"),
  },
  async ({ latitude, longitude }) => {
    const latFormatted = latitude.toFixed(4);
    const lonFormatted = longitude.toFixed(4);

    const pointsUrl = `${NWS_API_BASE}/points/${latFormatted},${lonFormatted}`;
    console.error(`Fetching grid point data from ${pointsUrl}`);
    const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

    if (!pointsData?.properties?.forecast) {
      console.error(`Failed to retrieve grid point data or forecast URL for coordinates: ${latFormatted}, ${lonFormatted}`);
      let errorMessage = `Failed to retrieve grid point data for coordinates: ${latFormatted}, ${lonFormatted}.`;
       if (!pointsData) {
           errorMessage += " Could not fetch data from the NWS /points endpoint.";
       } else if (!pointsData.properties?.forecast) {
           errorMessage += " The NWS API did not return a forecast URL for this location.";
       }
       errorMessage += " This may be because the location is outside the US coverage area."
      return {
        content: [{ type: "text", text: errorMessage }],
      };
    }

    const forecastUrl = pointsData.properties.forecast;
    const locationCity = pointsData.properties.relativeLocation?.properties?.city;
    const locationState = pointsData.properties.relativeLocation?.properties?.state;
    const locationName = locationCity && locationState ? `${locationCity}, ${locationState}` : `coordinates ${latFormatted}, ${lonFormatted}`;

    console.error(`Fetching forecast data from ${forecastUrl}`);
    const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);

    if (!forecastData?.properties?.periods) {
      console.error(`Failed to retrieve forecast data from ${forecastUrl}`);
      return {
        content: [{ type: "text", text: `Failed to retrieve forecast data for ${locationName}.` }],
      };
    }

    const periods = forecastData.properties.periods || [];
    if (periods.length === 0) {
       console.error(`No forecast periods available for ${locationName}`);
      return {
        content: [{ type: "text", text: `No forecast periods available for ${locationName}.` }],
      };
    }

    const formattedForecast = periods.map((period: ForecastPeriod) =>
      [
        `${period.name || "Unknown Period"}:`,
        `  Temperature: ${period.temperature ?? "N/A"}°${period.temperatureUnit || "F"}`,
        `  Wind: ${period.windSpeed || "N/A"} ${period.windDirection || ""}`,
        `  Forecast: ${period.shortForecast || "No forecast available"}`,
        "---",
      ].join("\n"),
    );

    const forecastText = `Weather forecast for ${locationName}:\n\n${formattedForecast.join("\n")}`;
    console.error(`Successfully retrieved forecast for ${locationName}`);

    return {
      content: [{ type: "text", text: forecastText }],
    };
  },
);

// Main function to set up and run the server
async function main() {
  // Use StdioServerTransport for communication via standard input/output
  const transport = new StdioServerTransport();
  // Connect the server instance to the transport
  await server.connect(transport);
  // Log to stderr so it doesn't interfere with stdout communication
  console.error("Weather MCP Server running on stdio");
}

// Execute the main function and handle potential errors
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
